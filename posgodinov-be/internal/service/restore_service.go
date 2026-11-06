package service

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migrate_postgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/service/storage"
	"posgodinov-backend/pkg/logger"
)

type RestoreReport struct {
	DatabasesRestored []string      `json:"databases_restored"`
	Duration          time.Duration `json:"duration"`
	TotalSizeBytes    int64         `json:"total_size_bytes"`
	Errors            []string      `json:"errors,omitempty"`
}

type RestoreOptions struct {
	Source     string // "local" or "gdrive"
	SpecificDB string // optional, if set only restore this database
	DryRun     bool   // if true, only discover without applying changes
}

type RestoreService interface {
	RunRestore(ctx context.Context, opts RestoreOptions) (*RestoreReport, error)
}

type restoreService struct {
	cfg         *config.Config
	localStore  *storage.LocalStorageProvider
	gdriveStore *storage.GoogleDriveStorageProvider
}

func NewRestoreService(
	cfg *config.Config,
	localStore *storage.LocalStorageProvider,
	gdriveStore *storage.GoogleDriveStorageProvider,
) RestoreService {
	return &restoreService{
		cfg:         cfg,
		localStore:  localStore,
		gdriveStore: gdriveStore,
	}
}

func (s *restoreService) RunRestore(ctx context.Context, opts RestoreOptions) (*RestoreReport, error) {
	startTime := time.Now()
	report := &RestoreReport{
		DatabasesRestored: make([]string, 0),
		Errors:            make([]string, 0),
	}

	source := strings.ToLower(strings.TrimSpace(opts.Source))
	if source == "" {
		source = strings.ToLower(strings.TrimSpace(s.cfg.RestoreSource))
		if source == "" {
			source = "local"
		}
	}

	var store storage.StorageProvider
	switch source {
	case "gdrive":
		if s.gdriveStore == nil {
			return nil, fmt.Errorf("google drive storage is not configured (check GDRIVE_SERVICE_ACCOUNT_JSON)")
		}
		store = s.gdriveStore
	case "local":
		store = s.localStore
	default:
		return nil, fmt.Errorf("unsupported restore source: %s (choose 'local' or 'gdrive')", source)
	}

	logger.Info("Starting database auto-restore", "source", source, "dry_run", opts.DryRun)

	// 1. Discover all database folders in the backup storage
	dbFolders, err := store.ListDBFolders(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list backup folders from %s: %w", source, err)
	}

	if len(dbFolders) == 0 {
		return nil, fmt.Errorf("no database backup folders found in %s", source)
	}

	logger.Info("Discovered backup folders", "count", len(dbFolders), "folders", dbFolders)

	if opts.DryRun {
		report.DatabasesRestored = dbFolders
		report.Duration = time.Since(startTime)
		return report, nil
	}

	// 2. Separate Landlord DB and Tenant DBs
	var landlordFolder string
	var tenantFolders []string

	for _, f := range dbFolders {
		lower := strings.ToLower(f)
		if opts.SpecificDB != "" && lower != strings.ToLower(opts.SpecificDB) {
			continue
		}

		if lower == "landlord" || lower == "posgodinov_landlord" || lower == strings.ToLower(s.cfg.DBName) {
			landlordFolder = f
		} else if strings.HasPrefix(lower, "business_") {
			tenantFolders = append(tenantFolders, f)
		} else {
			// Other database folder (treat as independent tenant/db)
			tenantFolders = append(tenantFolders, f)
		}
	}

	// 3. Connect to PostgreSQL maintenance database (e.g. postgres) to manage CREATE DATABASE
	maintenanceDB, err := s.connectMaintenanceDB()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres maintenance database: %w", err)
	}
	defer func() {
		if sqlDB, err := maintenanceDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	// 4. Restore Landlord DB first (if present or requested)
	if landlordFolder != "" {
		targetDBName := s.cfg.DBName
		logger.Info("Restoring Landlord Database", "folder", landlordFolder, "target_db", targetDBName)

		size, err := s.restoreSingleDB(ctx, store, landlordFolder, targetDBName, maintenanceDB, "db/migrations/landlord")
		if err != nil {
			errMsg := fmt.Sprintf("failed to restore landlord database: %v", err)
			logger.Error(errMsg)
			report.Errors = append(report.Errors, errMsg)
		} else {
			report.DatabasesRestored = append(report.DatabasesRestored, targetDBName)
			report.TotalSizeBytes += size
		}
	}

	// 5. Restore Tenant DBs
	for _, tf := range tenantFolders {
		targetDBName := tf // e.g. "business_abc123"
		logger.Info("Restoring Tenant Database", "folder", tf, "target_db", targetDBName)

		size, err := s.restoreSingleDB(ctx, store, tf, targetDBName, maintenanceDB, "db/migrations/business")
		if err != nil {
			errMsg := fmt.Sprintf("failed to restore tenant database %s: %v", targetDBName, err)
			logger.Error(errMsg)
			report.Errors = append(report.Errors, errMsg)
		} else {
			report.DatabasesRestored = append(report.DatabasesRestored, targetDBName)
			report.TotalSizeBytes += size
		}
	}

	report.Duration = time.Since(startTime)
	logger.Info("Database restore process completed",
		"restored_count", len(report.DatabasesRestored),
		"error_count", len(report.Errors),
		"duration", report.Duration.String(),
		"total_bytes", report.TotalSizeBytes,
	)

	return report, nil
}

func (s *restoreService) restoreSingleDB(
	ctx context.Context,
	store storage.StorageProvider,
	folderName string,
	targetDBName string,
	maintenanceDB *gorm.DB,
	migrationDir string,
) (int64, error) {
	// a. Ensure physical database exists
	if err := s.ensureDatabaseExists(ctx, maintenanceDB, targetDBName); err != nil {
		return 0, fmt.Errorf("failed to ensure database exists: %w", err)
	}

	// b. Run schema migrations
	if migrationDir != "" {
		if err := s.runMigrations(targetDBName, migrationDir); err != nil {
			logger.Warn("Migration warning during restore", "db", targetDBName, "error", err)
		}
	}

	// c. Fetch latest dump stream
	filename, dumpReader, err := store.GetLatestDump(ctx, folderName)
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve latest dump file: %w", err)
	}
	defer dumpReader.Close()

	logger.Info("Injecting dump file into database", "db", targetDBName, "file", filename)

	// d. Decompress and inject
	bytesRestored, err := s.injectDumpStream(ctx, targetDBName, dumpReader)
	if err != nil {
		return 0, fmt.Errorf("failed to inject SQL stream: %w", err)
	}

	return bytesRestored, nil
}

func (s *restoreService) connectMaintenanceDB() (*gorm.DB, error) {
	// Connect to default 'postgres' database
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s",
		s.cfg.DBHost, s.cfg.DBPort, s.cfg.DBUser, s.cfg.DBPassword, s.cfg.DBSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		// Fallback to template1 if postgres db is not accessible
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=template1 sslmode=%s",
			s.cfg.DBHost, s.cfg.DBPort, s.cfg.DBUser, s.cfg.DBPassword, s.cfg.DBSSLMode)
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: gormlogger.Default.LogMode(gormlogger.Silent),
		})
	}
	return db, err
}

func (s *restoreService) ensureDatabaseExists(ctx context.Context, maintenanceDB *gorm.DB, dbName string) error {
	var count int64
	err := maintenanceDB.WithContext(ctx).Raw("SELECT COUNT(1) FROM pg_database WHERE datname = ?", dbName).Scan(&count).Error
	if err != nil {
		return fmt.Errorf("failed to check database %s: %w", dbName, err)
	}

	if count == 0 {
		logger.Info("Creating database in PostgreSQL", "db", dbName)
		if err := maintenanceDB.WithContext(ctx).Exec(fmt.Sprintf("CREATE DATABASE %q", dbName)).Error; err != nil {
			return fmt.Errorf("failed to execute CREATE DATABASE %s: %w", dbName, err)
		}
	}
	return nil
}

func (s *restoreService) runMigrations(dbName string, migrationDir string) error {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		s.cfg.DBHost, s.cfg.DBPort, s.cfg.DBUser, s.cfg.DBPassword, dbName, s.cfg.DBSSLMode)

	sqlDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	driver, err := migrate_postgres.WithInstance(sqlDB, &migrate_postgres.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithDatabaseInstance("file://"+migrationDir, "postgres", driver)
	if err != nil {
		return err
	}

	if ver, dirty, vErr := m.Version(); vErr == nil && dirty && ver > 0 {
		_ = m.Force(int(ver) - 1)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}

func (s *restoreService) injectDumpStream(ctx context.Context, dbName string, dumpReader io.Reader) (int64, error) {
	gzReader, err := gzip.NewReader(dumpReader)
	if err != nil {
		return 0, fmt.Errorf("failed to open gzip decompressor: %w", err)
	}
	defer gzReader.Close()

	// Check if psql command-line client is available
	hasPsql := false
	if _, err := exec.LookPath("psql"); err == nil {
		hasPsql = true
	}

	if hasPsql {
		cmd := exec.CommandContext(ctx, "psql",
			"-h", s.cfg.DBHost,
			"-p", s.cfg.DBPort,
			"-U", s.cfg.DBUser,
			"-d", dbName,
			"--quiet",
			"--no-password",
		)
		cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", s.cfg.DBPassword))

		var sqlBuf bytes.Buffer
		teeReader := io.TeeReader(gzReader, &sqlBuf)

		cmd.Stdin = teeReader
		var errBuf bytes.Buffer
		cmd.Stderr = &errBuf

		if err := cmd.Run(); err != nil {
			logger.Warn("psql tool returned warning/error during inject", "db", dbName, "err", err, "stderr", errBuf.String())
		}
		return int64(sqlBuf.Len()), nil
	}

	// Fallback SQL statement executor if psql binary is not present
	sqlBytes, err := io.ReadAll(gzReader)
	if err != nil {
		return 0, fmt.Errorf("failed to read decompressed SQL: %w", err)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		s.cfg.DBHost, s.cfg.DBPort, s.cfg.DBUser, s.cfg.DBPassword, dbName, s.cfg.DBSSLMode)

	targetDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		return 0, fmt.Errorf("failed to connect to target db %s: %w", dbName, err)
	}
	defer func() {
		if sqlDB, err := targetDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	// Execute queries
	raw := string(sqlBytes)
	statements := strings.Split(raw, ";\n")
	for _, stmt := range statements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		_ = targetDB.WithContext(ctx).Exec(trimmed).Error
	}

	return int64(len(sqlBytes)), nil
}

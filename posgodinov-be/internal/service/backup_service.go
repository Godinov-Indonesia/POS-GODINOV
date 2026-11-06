package service

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service/storage"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/utils"
)

type backupService struct {
	cfg         *config.Config
	repo        domain.BackupRepository
	localStore  *storage.LocalStorageProvider
	gdriveStore *storage.GoogleDriveStorageProvider
	landlordDB  *gorm.DB
}

func NewBackupService(
	cfg *config.Config,
	repo domain.BackupRepository,
	localStore *storage.LocalStorageProvider,
	gdriveStore *storage.GoogleDriveStorageProvider,
	landlordDB *gorm.DB,
) domain.BackupService {
	return &backupService{
		cfg:         cfg,
		repo:        repo,
		localStore:  localStore,
		gdriveStore: gdriveStore,
		landlordDB:  landlordDB,
	}
}

func (s *backupService) TriggerBackup(ctx context.Context, triggeredBy string, req *domain.TriggerBackupRequest) (*domain.BackupJob, error) {
	if req.Target == "" {
		req.Target = domain.BackupTargetAll
	}
	if req.Mode == "" {
		req.Mode = domain.BackupModeFull
	}
	if req.StorageProvider == "" {
		req.StorageProvider = "LOCAL"
	}
	if req.Target == domain.BackupTargetTenant && strings.TrimSpace(req.TenantID) == "" {
		return nil, fmt.Errorf("tenant_id is required when target is TENANT")
	}

	var targetID *string
	if req.TenantID != "" {
		tid := strings.ToLower(strings.TrimSpace(req.TenantID))
		targetID = &tid
	}

	job := &domain.BackupJob{
		ID:              utils.NewUUID(),
		TargetType:      req.Target,
		TargetID:        targetID,
		Mode:            req.Mode,
		Status:          domain.BackupStatusPending,
		StorageProvider: req.StorageProvider,
		TriggeredBy:     triggeredBy,
		CreatedAt:       time.Now(),
	}

	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create backup job record: %w", err)
	}

	// Trigger async execution
	go s.executeBackupJob(job.ID, req.Target, targetID, req.Mode, req.StorageProvider, req.Tables)

	return job, nil
}

func (s *backupService) GetJob(ctx context.Context, id string) (*domain.BackupJob, error) {
	return s.repo.GetJobByID(ctx, id)
}

func (s *backupService) ListJobs(ctx context.Context, page, limit int) ([]*domain.BackupJob, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.repo.ListJobs(ctx, limit, offset)
}

func (s *backupService) ListFiles(ctx context.Context, filter domain.BackupFileFilter) ([]*domain.BackupFile, int64, error) {
	return s.repo.ListFiles(ctx, filter)
}

func (s *backupService) GetFileForDownload(ctx context.Context, id string) (*domain.BackupFile, io.ReadCloser, error) {
	file, err := s.repo.GetFileByID(ctx, id)
	if err != nil {
		return nil, nil, fmt.Errorf("backup file record not found: %w", err)
	}

	// Try reading from local store first
	reader, err := s.localStore.Read(ctx, file.FilePath)
	if err == nil {
		return file, reader, nil
	}

	// If local missing but GDrive available
	if s.gdriveStore != nil && file.RemoteFileID != nil && *file.RemoteFileID != "" {
		gReader, gErr := s.gdriveStore.Read(ctx, *file.RemoteFileID)
		if gErr == nil {
			return file, gReader, nil
		}
	}

	return nil, nil, fmt.Errorf("backup file could not be read from storage: %w", err)
}

func (s *backupService) DeleteFile(ctx context.Context, id string) error {
	file, err := s.repo.GetFileByID(ctx, id)
	if err != nil {
		return fmt.Errorf("backup file record not found: %w", err)
	}

	_ = s.localStore.Delete(ctx, file.FilePath)
	if s.gdriveStore != nil && file.RemoteFileID != nil && *file.RemoteFileID != "" {
		_ = s.gdriveStore.Delete(ctx, *file.RemoteFileID)
	}

	return s.repo.DeleteFile(ctx, id)
}

// executeBackupJob runs in background goroutine
func (s *backupService) executeBackupJob(jobID string, target domain.BackupTargetType, targetID *string, mode domain.BackupMode, storageProvider string, specificTables []string) {
	ctx := context.Background()
	now := time.Now()

	logger.Info("Starting backup job", "job_id", jobID, "target", target, "mode", mode)
	_ = s.repo.UpdateJobProgress(ctx, jobID, 0, 0, domain.BackupStatusInProgress, nil, nil)

	var tid string
	if targetID != nil {
		tid = *targetID
	}
	dbNames, err := s.discoverDatabases(ctx, target, tid)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to discover databases: %v", err)
		logger.Error("Backup job failed during discovery", "job_id", jobID, "error", err)
		_ = s.repo.UpdateJobProgress(ctx, jobID, 0, 0, domain.BackupStatusFailed, &errMsg, &now)
		return
	}

	var totalSize int64
	completedCount := 0
	timestampStr := now.Format("2006-01-02_15-04-05")

	for _, dbName := range dbNames {
		logger.Info("Processing backup for database", "job_id", jobID, "db", dbName)

		// 1. Full Database Dump
		if mode == domain.BackupModeFull || mode == domain.BackupModeFullAndTables {
			bf, err := s.dumpDatabase(ctx, dbName, jobID, timestampStr, storageProvider)
			if err != nil {
				logger.Error("Failed to dump database", "db", dbName, "error", err)
				errMsg := fmt.Sprintf("Failed on DB %s: %v", dbName, err)
				_ = s.repo.UpdateJobProgress(ctx, jobID, completedCount, totalSize, domain.BackupStatusFailed, &errMsg, &now)
				return
			}
			totalSize += bf.FileSizeBytes
		}

		// 2. Tables Dump
		if mode == domain.BackupModeTables || mode == domain.BackupModeFullAndTables {
			tables := specificTables
			if len(tables) == 0 {
				tables, err = s.getDatabaseTables(ctx, dbName)
				if err != nil {
					logger.Warn("Failed to list tables for DB, skipping table dump", "db", dbName, "error", err)
					tables = nil
				}
			}

			for _, tbl := range tables {
				tbl = strings.TrimSpace(tbl)
				if tbl == "" {
					continue
				}
				bf, err := s.dumpTable(ctx, dbName, tbl, jobID, timestampStr, storageProvider)
				if err != nil {
					logger.Warn("Failed to dump table", "db", dbName, "table", tbl, "error", err)
					continue
				}
				totalSize += bf.FileSizeBytes
			}
		}

		completedCount++
		_ = s.repo.UpdateJobProgress(ctx, jobID, completedCount, totalSize, domain.BackupStatusInProgress, nil, nil)
	}

	finishTime := time.Now()
	_ = s.repo.UpdateJobProgress(ctx, jobID, completedCount, totalSize, domain.BackupStatusCompleted, nil, &finishTime)
	logger.Info("Backup job completed successfully", "job_id", jobID, "completed_dbs", completedCount, "total_size_bytes", totalSize)
}

func (s *backupService) discoverDatabases(ctx context.Context, target domain.BackupTargetType, targetID string) ([]string, error) {
	switch target {
	case domain.BackupTargetLandlord:
		return []string{s.cfg.DBName}, nil

	case domain.BackupTargetTenant:
		cleanTid := strings.ToLower(strings.TrimSpace(targetID))
		if cleanTid == "" {
			return nil, fmt.Errorf("tenant target ID is empty")
		}
		return []string{"business_" + cleanTid}, nil

	case domain.BackupTargetAll:
		var dbs []string
		// Always include Landlord DB first
		dbs = append(dbs, s.cfg.DBName)

		if s.landlordDB != nil {
			// Discover all tenant databases from PostgreSQL
			var rows []string
			err := s.landlordDB.WithContext(ctx).Raw("SELECT datname FROM pg_database WHERE datname LIKE 'business_%'").Scan(&rows).Error
			if err == nil && len(rows) > 0 {
				for _, r := range rows {
					if r != s.cfg.DBName {
						dbs = append(dbs, r)
					}
				}
			} else {
				// Fallback: discover active business tenants from businesses table
				var bizIDs []string
				if bErr := s.landlordDB.WithContext(ctx).Table("businesses").Pluck("id", &bizIDs).Error; bErr == nil {
					for _, bid := range bizIDs {
						dbs = append(dbs, "business_"+strings.ToLower(bid))
					}
				}
			}
		}
		return dbs, nil

	default:
		return nil, fmt.Errorf("unsupported backup target: %s", target)
	}
}

func (s *backupService) getDatabaseTables(ctx context.Context, dbName string) ([]string, error) {
	dbConn, err := s.connectToDB(dbName)
	if err != nil {
		return nil, err
	}
	defer func() {
		if sqlDB, err := dbConn.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	var tables []string
	query := `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		  AND table_type = 'BASE TABLE'
		  AND table_name NOT LIKE 'schema_migrations%'
		ORDER BY table_name;
	`
	if err := dbConn.WithContext(ctx).Raw(query).Scan(&tables).Error; err != nil {
		return nil, err
	}
	return tables, nil
}

func (s *backupService) connectToDB(dbName string) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		s.cfg.DBHost, s.cfg.DBPort, s.cfg.DBUser, s.cfg.DBPassword, dbName, s.cfg.DBSSLMode)

	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
}

// dumpDatabase performs full database dump
func (s *backupService) dumpDatabase(ctx context.Context, dbName string, jobID string, timestampStr string, storageProvider string) (*domain.BackupFile, error) {
	relPath := fmt.Sprintf("%s/full/full_%s_%s.sql.gz", dbName, dbName, timestampStr)

	compressedData, checksum, err := s.generateDump(ctx, dbName, "")
	if err != nil {
		return nil, fmt.Errorf("failed to generate full dump for %s: %w", dbName, err)
	}

	return s.saveAndRecordFile(ctx, jobID, dbName, domain.BackupScopeFull, nil, relPath, compressedData, checksum, storageProvider)
}

// dumpTable performs dump for an individual table
func (s *backupService) dumpTable(ctx context.Context, dbName string, tableName string, jobID string, timestampStr string, storageProvider string) (*domain.BackupFile, error) {
	relPath := fmt.Sprintf("%s/tables/%s/%s.sql.gz", dbName, timestampStr, tableName)

	compressedData, checksum, err := s.generateDump(ctx, dbName, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to generate table dump for %s.%s: %w", dbName, tableName, err)
	}

	tblNameCopy := tableName
	return s.saveAndRecordFile(ctx, jobID, dbName, domain.BackupScopeTable, &tblNameCopy, relPath, compressedData, checksum, storageProvider)
}

// generateDump runs pg_dump or fallback SQL extractor and returns compressed gzip bytes and sha256 checksum
func (s *backupService) generateDump(ctx context.Context, dbName string, tableName string) ([]byte, string, error) {
	hasPgDump := false
	if _, err := exec.LookPath("pg_dump"); err == nil {
		hasPgDump = true
	}

	var rawSQL []byte
	var err error

	if hasPgDump {
		args := []string{
			"-h", s.cfg.DBHost,
			"-p", s.cfg.DBPort,
			"-U", s.cfg.DBUser,
			"--no-password",
			"--clean",
			"--if-exists",
			"--single-transaction",
		}
		if tableName != "" {
			args = append(args, "-t", tableName)
		}
		args = append(args, dbName)

		cmd := exec.CommandContext(ctx, "pg_dump", args...)
		cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", s.cfg.DBPassword))

		var outBuf, errBuf bytes.Buffer
		cmd.Stdout = &outBuf
		cmd.Stderr = &errBuf

		if cmdErr := cmd.Run(); cmdErr != nil {
			logger.Warn("pg_dump exited with error, falling back to SQL extractor", "db", dbName, "err", cmdErr, "stderr", errBuf.String())
			rawSQL, err = s.fallbackExtractSQL(ctx, dbName, tableName)
		} else {
			rawSQL = outBuf.Bytes()
		}
	} else {
		rawSQL, err = s.fallbackExtractSQL(ctx, dbName, tableName)
	}

	if err != nil {
		return nil, "", err
	}

	// Gzip compress
	var gzBuf bytes.Buffer
	gzWriter := gzip.NewWriter(&gzBuf)
	if _, err := gzWriter.Write(rawSQL); err != nil {
		return nil, "", fmt.Errorf("gzip write failed: %w", err)
	}
	if err := gzWriter.Close(); err != nil {
		return nil, "", fmt.Errorf("gzip close failed: %w", err)
	}

	compressed := gzBuf.Bytes()
	hasher := sha256.New()
	hasher.Write(compressed)
	checksum := hex.EncodeToString(hasher.Sum(nil))

	return compressed, checksum, nil
}

// fallbackExtractSQL provides pure SQL dump when pg_dump is unavailable (e.g. testing)
func (s *backupService) fallbackExtractSQL(ctx context.Context, dbName string, tableName string) ([]byte, error) {
	dbConn, err := s.connectToDB(dbName)
	if err != nil {
		return nil, fmt.Errorf("fallback connection failed for %s: %w", dbName, err)
	}
	defer func() {
		if sqlDB, err := dbConn.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	var targetTables []string
	if tableName != "" {
		targetTables = []string{tableName}
	} else {
		targetTables, err = s.getDatabaseTables(ctx, dbName)
		if err != nil {
			return nil, err
		}
	}

	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("-- POS-GODINOV Database Backup: %s\n-- Generated: %s\n\n", dbName, time.Now().Format(time.RFC3339)))

	for _, tbl := range targetTables {
		buf.WriteString(fmt.Sprintf("-- Table: %s\n", tbl))
		var rows []map[string]interface{}
		if err := dbConn.WithContext(ctx).Table(tbl).Find(&rows).Error; err != nil {
			continue
		}
		for _, row := range rows {
			var cols []string
			var vals []string
			for k, v := range row {
				cols = append(cols, fmt.Sprintf("%q", k))
				if v == nil {
					vals = append(vals, "NULL")
				} else {
					vals = append(vals, fmt.Sprintf("'%v'", strings.ReplaceAll(fmt.Sprintf("%v", v), "'", "''")))
				}
			}
			if len(cols) > 0 {
				buf.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s);\n", tbl, strings.Join(cols, ", "), strings.Join(vals, ", ")))
			}
		}
		buf.WriteString("\n")
	}

	return buf.Bytes(), nil
}

func (s *backupService) saveAndRecordFile(
	ctx context.Context,
	jobID string,
	dbName string,
	scope domain.BackupScope,
	tableName *string,
	relPath string,
	data []byte,
	checksum string,
	storageProvider string,
) (*domain.BackupFile, error) {
	fileSizeBytes := int64(len(data))
	fileRecord := &domain.BackupFile{
		ID:              utils.NewUUID(),
		JobID:           jobID,
		DBName:          dbName,
		Scope:           scope,
		TableNameColumn: tableName,
		FilePath:        relPath,
		FileSizeBytes:   fileSizeBytes,
		ChecksumSHA256:  checksum,
		StorageProvider: storageProvider,
		CreatedAt:       time.Now(),
	}

	// Always save locally first as reliable cache
	_, err := s.localStore.Save(ctx, relPath, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to save backup locally: %w", err)
	}

	// If Google Drive is requested and provider is initialized
	if (storageProvider == "GDRIVE" || storageProvider == "BOTH") && s.gdriveStore != nil {
		res, gErr := s.gdriveStore.Save(ctx, relPath, bytes.NewReader(data))
		if gErr != nil {
			logger.Warn("Failed to upload backup to Google Drive", "path", relPath, "error", gErr)
		} else {
			fileRecord.RemoteFileID = &res.RemoteID
			if res.RemoteLink != "" {
				fileRecord.RemoteWebLink = &res.RemoteLink
			}
		}
	}

	if err := s.repo.AddFile(ctx, fileRecord); err != nil {
		return nil, fmt.Errorf("failed to record backup file: %w", err)
	}

	return fileRecord, nil
}

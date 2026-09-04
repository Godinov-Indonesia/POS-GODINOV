package database

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migrate_postgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"posgodinov-backend/internal/config"
)

// BusinessDBManager handles the connection pool for multiple business databases.
type BusinessDBManager struct {
	mu         sync.RWMutex
	businessPool map[string]*gorm.DB
	cfg        *config.Config
	landlordDB *gorm.DB
}

var validBusinessName = regexp.MustCompile(`(?i)^[a-z0-9_]+$`)

// NewBusinessDBManager creates a new instance of BusinessDBManager.
func NewBusinessDBManager(cfg *config.Config, landlordDB *gorm.DB) *BusinessDBManager {
	return &BusinessDBManager{
		businessPool: make(map[string]*gorm.DB),
		cfg:        cfg,
		landlordDB: landlordDB,
	}
}

// GetBusinessDB retrieves a database connection for a specific business.
// It uses lazy-loading: if the connection doesn't exist in the pool, it creates one.
func (tm *BusinessDBManager) GetBusinessDB(ctx context.Context, businessID string) (*gorm.DB, error) {
	if !validBusinessName.MatchString(businessID) {
		return nil, fmt.Errorf("invalid tenant ID format")
	}

	businessID = strings.ToLower(businessID)

	// 1. Check if connection exists in pool (Read Lock)
	tm.mu.RLock()
	db, exists := tm.businessPool[businessID]
	tm.mu.RUnlock()

	if exists {
		return db.WithContext(ctx), nil
	}

	// 2. Connection doesn't exist, acquire Write Lock to create and store
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// Double check pattern: maybe another goroutine just created it while we were waiting for the lock
	if db, exists = tm.businessPool[businessID]; exists {
		return db.WithContext(ctx), nil
	}

	// Create new connection
	newDB, err := tm.createBusinessConnection(businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection for tenant %s: %w", businessID, err)
	}

	tm.businessPool[businessID] = newDB
	return newDB.WithContext(ctx), nil
}

// createBusinessConnection establishes a GORM connection to a specific business DB.
func (tm *BusinessDBManager) createBusinessConnection(businessID string) (*gorm.DB, error) {
	dbName := "business_" + businessID // Prefix for safety
	
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		tm.cfg.DBHost, tm.cfg.DBPort, tm.cfg.DBUser, tm.cfg.DBPassword, dbName, tm.cfg.DBSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn), // Avoid too much spam in multi-tenant
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Important to prevent OOM / DB connection limits exhausted
	sqlDB.SetMaxOpenConns(10) // Limit per tenant, adjust based on total tenants and DB specs
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// CreateNewTenantDatabase creates the physical database for a new tenant and runs migrations.
// This should be called by the Landlord DB connection when registering a new business.
func (tm *BusinessDBManager) CreateNewTenantDatabase(businessID string) error {
	if !validBusinessName.MatchString(businessID) {
		return fmt.Errorf("invalid tenant ID format")
	}

	businessID = strings.ToLower(businessID)
	dbName := fmt.Sprintf("business_%s", businessID)

	// Create database if it doesn't exist.
	// In PostgreSQL, CREATE DATABASE cannot be executed within a transaction block.
	// So we execute it directly on the landlordDB instance.
	err := tm.landlordDB.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName)).Error
	if err != nil {
		return fmt.Errorf("failed to create database %s: %w", dbName, err)
	}

	// Now run migrations on the newly created business DB
	businessDB, err := tm.createBusinessConnection(businessID)
	if err != nil {
		tm.landlordDB.Exec(fmt.Sprintf("DROP DATABASE %s", dbName))
		return fmt.Errorf("database created but failed to connect for migration: %w", err)
	}
	
	err = tm.runBusinessMigrations(businessDB)
	if err != nil {
		// Tutup koneksi gorm agar PostgreSQL mengizinkan DROP DATABASE
		if sqlDB, dbErr := businessDB.DB(); dbErr == nil {
			sqlDB.Close()
		}
		// Hapus database karena gagal migrasi
		tm.landlordDB.Exec(fmt.Sprintf("DROP DATABASE %s", dbName))
		return fmt.Errorf("failed to migrate tenant db: %w", err)
	}

	// Add to pool
	tm.mu.Lock()
	tm.businessPool[businessID] = businessDB
	tm.mu.Unlock()

	return nil
}

func (tm *BusinessDBManager) runBusinessMigrations(businessDB *gorm.DB) error {
	sqlDB, err := businessDB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB for tenant migration: %w", err)
	}

	driver, err := migrate_postgres.WithInstance(sqlDB, &migrate_postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migrate driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://db/migrations/business",
		"postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to init migrate for tenant: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrate up for tenant: %w", err)
	}

	return nil
}

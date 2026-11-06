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

	// 2. Connection doesn't exist — create outside global write lock so slow dials/migrations don't block other tenants
	newDB, err := tm.createBusinessConnection(businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection for tenant %s: %w", businessID, err)
	}

	tm.mu.Lock()
	if existingDB, exists := tm.businessPool[businessID]; exists {
		tm.mu.Unlock()
		if sqlDB, dbErr := newDB.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
		return existingDB.WithContext(ctx), nil
	}
	tm.businessPool[businessID] = newDB
	tm.mu.Unlock()
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
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Pastikan migrasi database tenant selalu up-to-date saat koneksi pertama dibuat
	if err := tm.runBusinessMigrations(db); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("failed to run migrations for tenant %s: %w", businessID, err)
	}

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

	// Check if database already exists (idempotent for OAuth account linking)
	var exists int64
	if err := tm.landlordDB.Raw("SELECT COUNT(1) FROM pg_database WHERE datname = ?", dbName).Scan(&exists).Error; err != nil {
		return fmt.Errorf("failed to check existing database %s: %w", dbName, err)
	}

	if exists == 0 {
		err := tm.landlordDB.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName)).Error
		if err != nil {
			return fmt.Errorf("failed to create database %s: %w", dbName, err)
		}
	}

	// Connect and run migrations (createBusinessConnection already runs runBusinessMigrations and closes sqlDB on error)
	businessDB, err := tm.createBusinessConnection(businessID)
	if err != nil {
		if exists == 0 {
			tm.landlordDB.Exec(fmt.Sprintf("DROP DATABASE %s", dbName))
		}
		return fmt.Errorf("database created but failed to connect/migrate: %w", err)
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

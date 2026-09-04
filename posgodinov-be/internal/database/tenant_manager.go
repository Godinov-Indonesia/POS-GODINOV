package database

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"posgodinov-backend/internal/config"
)

// TenantManager handles the connection pool for multiple tenant databases.
type TenantManager struct {
	mu         sync.RWMutex
	tenantPool map[string]*gorm.DB
	cfg        *config.Config
}

var validTenantName = regexp.MustCompile(`^[a-z0-9_]+$`)

// NewTenantManager creates a new instance of TenantManager.
func NewTenantManager(cfg *config.Config) *TenantManager {
	return &TenantManager{
		tenantPool: make(map[string]*gorm.DB),
		cfg:        cfg,
	}
}

// GetTenantDB retrieves a database connection for a specific tenant.
// It uses lazy-loading: if the connection doesn't exist in the pool, it creates one.
func (tm *TenantManager) GetTenantDB(ctx context.Context, tenantID string) (*gorm.DB, error) {
	if !validTenantName.MatchString(tenantID) {
		return nil, fmt.Errorf("invalid tenant ID format")
	}

	// 1. Check if connection exists in pool (Read Lock)
	tm.mu.RLock()
	db, exists := tm.tenantPool[tenantID]
	tm.mu.RUnlock()

	if exists {
		return db.WithContext(ctx), nil
	}

	// 2. Connection doesn't exist, acquire Write Lock to create and store
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// Double check pattern: maybe another goroutine just created it while we were waiting for the lock
	if db, exists = tm.tenantPool[tenantID]; exists {
		return db.WithContext(ctx), nil
	}

	// Create new connection
	newDB, err := tm.createTenantConnection(tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection for tenant %s: %w", tenantID, err)
	}

	tm.tenantPool[tenantID] = newDB
	return newDB.WithContext(ctx), nil
}

// createTenantConnection establishes a GORM connection to a specific tenant DB.
func (tm *TenantManager) createTenantConnection(tenantID string) (*gorm.DB, error) {
	dbName := "tenant_" + tenantID // Prefix for safety
	
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
func (tm *TenantManager) CreateNewTenantDatabase(landlordDB *gorm.DB, tenantID string) error {
	if !validTenantName.MatchString(tenantID) {
		return fmt.Errorf("invalid tenant ID format")
	}

	dbName := "tenant_" + tenantID

	// SQL Injection Prevention: We validated the tenantID via Regex above, so it is safe to use in string formatting for DDL
	// GORM / database/sql does not support parameters in CREATE DATABASE
	createDBQuery := fmt.Sprintf("CREATE DATABASE %s", dbName)
	
	err := landlordDB.Exec(createDBQuery).Error
	if err != nil {
		return fmt.Errorf("failed to create database %s: %w", dbName, err)
	}

	// Now run migrations on the newly created tenant DB
	tenantDB, err := tm.createTenantConnection(tenantID)
	if err != nil {
		return fmt.Errorf("database created but failed to connect for migration: %w", err)
	}

	// NOTE: You will need to move your schema definitions here or use golang-migrate
	// For GORM auto-migration example:
	// err = tenantDB.AutoMigrate(&domain.Product{}, &domain.RawMaterial{}, ...)
	
	// If using golang-migrate, you would extract sql.DB and run it against the tenant migrations folder
	err = tm.runTenantMigrations(tenantDB)
	if err != nil {
		return fmt.Errorf("failed to migrate tenant db: %w", err)
	}

	// Add to pool
	tm.mu.Lock()
	tm.tenantPool[tenantID] = tenantDB
	tm.mu.Unlock()

	return nil
}

func (tm *TenantManager) runTenantMigrations(tenantDB *gorm.DB) error {
	// Implement tenant-specific golang-migrate logic here
	// This will point to file://db/migrations/tenant
	return nil
}

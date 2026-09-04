package database

import (
	"context"
	"testing"

	"gorm.io/gorm"
)

func TestGetDB_RoutingPriority(t *testing.T) {
	// Create dummy DB instances
	rootDB := &gorm.DB{}
	tenantDB := &gorm.DB{}
	txDB := &gorm.DB{}

	ctx := context.Background()

	// 1. Default fallback
	db := GetDB(ctx, rootDB)
	if db != rootDB {
		t.Errorf("Expected rootDB, got something else")
	}

	// 2. Tenant DB takes precedence over root
	ctxTenant := context.WithValue(ctx, TenantDBKey, tenantDB)
	db = GetDB(ctxTenant, rootDB)
	if db != tenantDB {
		t.Errorf("Expected tenantDB, got something else")
	}

	// 3. Transaction takes highest precedence
	ctxTx := context.WithValue(ctxTenant, txKey, txDB)
	db = GetDB(ctxTx, rootDB)
	if db != txDB {
		t.Errorf("Expected txDB, got something else")
	}
}

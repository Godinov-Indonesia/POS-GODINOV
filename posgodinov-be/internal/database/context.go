package database

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// ExtractTenantDB retrieves the tenant database connection from the context.
func ExtractTenantDB(ctx context.Context, key interface{}) (*gorm.DB, error) {
	db, ok := ctx.Value(key).(*gorm.DB)
	if !ok || db == nil {
		return nil, errors.New("tenant database not found in context")
	}
	return db, nil
}

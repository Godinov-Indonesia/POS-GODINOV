package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresAuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) domain.AuditRepository {
	return &postgresAuditRepository{db: db}
}

func (r *postgresAuditRepository) Create(ctx context.Context, log *domain.AuditLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(log).Error
}

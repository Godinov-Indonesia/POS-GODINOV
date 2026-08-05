package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresRestockLogRepository struct {
	db *gorm.DB
}

func NewRestockLogRepository(db *gorm.DB) domain.RestockLogRepository {
	return &postgresRestockLogRepository{db: db}
}

func (r *postgresRestockLogRepository) Create(ctx context.Context, log *domain.RestockLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(log).Error
}

func (r *postgresRestockLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RestockLog, error) {
	db := database.GetDB(ctx, r.db)
	var logs []*domain.RestockLog
	err := db.WithContext(ctx).Where("outlet_id = ?", outletID).Order("created_at desc").Find(&logs).Error
	return logs, err
}

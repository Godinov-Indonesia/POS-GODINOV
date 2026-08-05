package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresWasteLogRepository struct {
	db *gorm.DB
}

func NewWasteLogRepository(db *gorm.DB) domain.WasteLogRepository {
	return &postgresWasteLogRepository{db: db}
}

func (r *postgresWasteLogRepository) Create(ctx context.Context, log *domain.WasteLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(log).Error
}

func (r *postgresWasteLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.WasteLog, error) {
	db := database.GetDB(ctx, r.db)
	var logs []*domain.WasteLog
	err := db.WithContext(ctx).Where("outlet_id = ?", outletID).Order("created_at desc").Find(&logs).Error
	return logs, err
}

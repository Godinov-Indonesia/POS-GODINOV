package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/database"
)

type postgresOutletRepository struct {
	db *gorm.DB
}

func NewOutletRepository(db *gorm.DB) domain.OutletRepository {
	return &postgresOutletRepository{db: db}
}

func (r *postgresOutletRepository) Create(ctx context.Context, outlet *domain.Outlet) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(outlet).Error
}

func (r *postgresOutletRepository) CountByBusinessID(ctx context.Context, businessID string) (int64, error) {
	db := database.GetDB(ctx, r.db)
	var count int64
	err := db.WithContext(ctx).Model(&domain.Outlet{}).Where("business_id = ?", businessID).Count(&count).Error
	return count, err
}

func (r *postgresOutletRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Outlet, error) {
	db := database.GetDB(ctx, r.db)
	var outlets []*domain.Outlet
	err := db.WithContext(ctx).Where("business_id = ?", businessID).Order("created_at asc").Find(&outlets).Error
	return outlets, err
}

func (r *postgresOutletRepository) GetBySerialOutlet(ctx context.Context, businessID, serial string) (*domain.Outlet, error) {
	db := database.GetDB(ctx, r.db)
	var o domain.Outlet
	if err := db.WithContext(ctx).Where("business_id = ? AND serial_outlet = ?", businessID, serial).First(&o).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("outlet not found")
		}
		return nil, err
	}
	return &o, nil
}

func (r *postgresOutletRepository) GetByID(ctx context.Context, id string) (*domain.Outlet, error) {
	db := database.GetDB(ctx, r.db)
	var o domain.Outlet
	if err := db.WithContext(ctx).Where("id = ?", id).First(&o).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("outlet not found")
		}
		return nil, err
	}
	return &o, nil
}

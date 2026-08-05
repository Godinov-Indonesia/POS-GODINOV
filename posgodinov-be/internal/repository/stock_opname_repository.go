package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresStockOpnameRepository struct {
	db *gorm.DB
}

func NewStockOpnameRepository(db *gorm.DB) domain.StockOpnameRepository {
	return &postgresStockOpnameRepository{db: db}
}

func (r *postgresStockOpnameRepository) Create(ctx context.Context, opname *domain.StockOpname) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(opname).Error
}

func (r *postgresStockOpnameRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.StockOpname, error) {
	db := database.GetDB(ctx, r.db)
	var opnames []*domain.StockOpname
	err := db.WithContext(ctx).Where("outlet_id = ?", outletID).Order("created_at desc").Find(&opnames).Error
	return opnames, err
}

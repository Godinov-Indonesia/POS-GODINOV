package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresCategoryRepository struct {
	db *gorm.DB
}

func NewProductCategoryRepository(db *gorm.DB) domain.ProductCategoryRepository {
	return &postgresCategoryRepository{db: db}
}

func (r *postgresCategoryRepository) Create(ctx context.Context, category *domain.ProductCategory) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(category).Error
}

func (r *postgresCategoryRepository) CreateBulk(ctx context.Context, categories []*domain.ProductCategory) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(&categories).Error
}

func (r *postgresCategoryRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.ProductCategory, error) {
	db := database.GetDB(ctx, r.db)
	var categories []*domain.ProductCategory
	err := db.WithContext(ctx).Where("outlet_id = ? AND is_deleted = ?", outletID, false).Order("name asc").Find(&categories).Error
	return categories, err
}

func (r *postgresCategoryRepository) GetByID(ctx context.Context, id string) (*domain.ProductCategory, error) {
	db := database.GetDB(ctx, r.db)
	var category domain.ProductCategory
	if err := db.WithContext(ctx).Where("id = ? AND is_deleted = ?", id, false).First(&category).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kategori tidak ditemukan")
		}
		return nil, err
	}
	return &category, nil
}

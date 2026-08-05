package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresRawMaterialRepository struct {
	db *gorm.DB
}

func NewRawMaterialRepository(db *gorm.DB) domain.RawMaterialRepository {
	return &postgresRawMaterialRepository{db: db}
}

func (r *postgresRawMaterialRepository) Create(ctx context.Context, rawMaterial *domain.RawMaterial) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(rawMaterial).Error
}

func (r *postgresRawMaterialRepository) CreateBulk(ctx context.Context, rawMaterials []*domain.RawMaterial) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(&rawMaterials).Error
}

func (r *postgresRawMaterialRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RawMaterial, error) {
	db := database.GetDB(ctx, r.db)
	var rawMaterials []*domain.RawMaterial
	err := db.WithContext(ctx).Where("outlet_id = ? AND is_deleted = ?", outletID, false).Order("name asc").Find(&rawMaterials).Error
	return rawMaterials, err
}

func (r *postgresRawMaterialRepository) GetByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	db := database.GetDB(ctx, r.db)
	var rm domain.RawMaterial
	if err := db.WithContext(ctx).Where("id = ? AND is_deleted = ?", id, false).First(&rm).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("raw material not found")
		}
		return nil, err
	}
	return &rm, nil
}

func (r *postgresRawMaterialRepository) LockByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	db := database.GetDB(ctx, r.db)
	var rm domain.RawMaterial
	if err := db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND is_deleted = ?", id, false).
		First(&rm).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("raw material not found")
		}
		return nil, err
	}
	return &rm, nil
}

func (r *postgresRawMaterialRepository) GetByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	db := database.GetDB(ctx, r.db)
	var rawMaterials []*domain.RawMaterial
	if err := db.WithContext(ctx).Where("id IN ? AND is_deleted = ?", ids, false).Find(&rawMaterials).Error; err != nil {
		return nil, err
	}
	rmMap := make(map[string]*domain.RawMaterial)
	for _, rm := range rawMaterials {
		rmMap[rm.ID] = rm
	}
	return rmMap, nil
}

func (r *postgresRawMaterialRepository) LockByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	db := database.GetDB(ctx, r.db)
	var rawMaterials []*domain.RawMaterial
	if err := db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ? AND is_deleted = ?", ids, false).
		Order("id ASC"). // Sort by ID to prevent deadlocks
		Find(&rawMaterials).Error; err != nil {
		return nil, err
	}
	rmMap := make(map[string]*domain.RawMaterial)
	for _, rm := range rawMaterials {
		rmMap[rm.ID] = rm
	}
	return rmMap, nil
}

func (r *postgresRawMaterialRepository) UpdateStock(ctx context.Context, id string, newStock float64) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.RawMaterial{}).Where("id = ?", id).Update("stock", newStock).Error
}

func (r *postgresRawMaterialRepository) UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.RawMaterial{}).Where("id = ?", id).Updates(map[string]interface{}{
		"stock":         newStock,
		"cost_per_unit": newCost,
	}).Error
}

func (r *postgresRawMaterialRepository) Update(ctx context.Context, rm *domain.RawMaterial) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Save(rm).Error
}

func (r *postgresRawMaterialRepository) Delete(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.RawMaterial{}).Where("id = ?", id).Update("is_deleted", true).Error
}

package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresProductRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) domain.ProductRepository {
	return &postgresProductRepository{db: db}
}

func (r *postgresProductRepository) CreateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	db := database.GetDB(ctx, r.db)
	// GORM will automatically create the associated Recipes because of foreignKey relationship
	return db.WithContext(ctx).Create(product).Error
}

func (r *postgresProductRepository) CreateBulkProductsWithRecipes(ctx context.Context, products []*domain.Product) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(&products).Error
}

func (r *postgresProductRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Product, error) {
	db := database.GetDB(ctx, r.db)
	var products []*domain.Product
	// Preload the recipes and their respective raw material details, as well as category
	err := db.WithContext(ctx).
		Preload("Recipes.RawMaterial").
		Preload("Category").
		Where("outlet_id = ? AND is_deleted = ?", outletID, false).
		Order("name asc").
		Find(&products).Error
	return products, err
}

func (r *postgresProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	db := database.GetDB(ctx, r.db)
	var p domain.Product
	if err := db.WithContext(ctx).Preload("Recipes").Preload("Category").Where("id = ? AND is_deleted = ?", id, false).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *postgresProductRepository) DeleteProduct(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.Product{}).Where("id = ?", id).Update("is_deleted", true).Error
}

func (r *postgresProductRepository) UpdateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	db := database.GetDB(ctx, r.db)
	
	// First, delete old recipes
	if err := db.WithContext(ctx).Where("product_id = ?", product.ID).Delete(&domain.ProductRecipe{}).Error; err != nil {
		return err
	}
	
	// Update the product fields
	if err := db.WithContext(ctx).Save(product).Error; err != nil {
		return err
	}
	
	// Because GORM Save on struct with associations might not recreate recipes nicely if primary keys conflict or we just deleted them, 
	// we manually insert the recipes
	for i := range product.Recipes {
		product.Recipes[i].ProductID = product.ID
		if err := db.WithContext(ctx).Create(product.Recipes[i]).Error; err != nil {
			return err
		}
	}
	
	return nil
}

package domain

import (
	"context"
	"time"
)

type Product struct {
	ID        string           `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID  string           `json:"outlet_id" gorm:"column:outlet_id"`
	Name      string           `json:"name" gorm:"column:name"`
	Price      float64          `json:"price" gorm:"column:price"`
	ImageURL   string           `json:"image_url" gorm:"column:image_url"`
	CategoryID *string          `json:"category_id" gorm:"column:category_id"`
	IsDeleted  bool             `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt  time.Time        `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt  time.Time        `json:"updated_at,omitzero" gorm:"column:updated_at"`
	Recipes    []*ProductRecipe `json:"recipes,omitempty" gorm:"foreignKey:ProductID"`
	Category   *ProductCategory `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
}

type ProductRecipe struct {
	ID            string       `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ProductID     string       `json:"product_id" gorm:"column:product_id"`
	RawMaterialID string       `json:"raw_material_id" gorm:"column:raw_material_id"`
	Quantity      float64      `json:"quantity" gorm:"column:quantity"`
	CreatedAt     time.Time    `json:"created_at,omitzero" gorm:"column:created_at"`
	RawMaterial   *RawMaterial `json:"raw_material,omitempty" gorm:"foreignKey:RawMaterialID"`
}

type CreateProductRecipeRequest struct {
	RawMaterialID string  `json:"raw_material_id"`
	Quantity      float64 `json:"quantity"`
}

type CreateProductRequest struct {
	Name       string                       `json:"name"`
	Price      float64                      `json:"price"`
	ImageURL   string                       `json:"image_url"`
	CategoryID *string                      `json:"category_id"`
	Recipes    []CreateProductRecipeRequest `json:"recipes"`
}

type ProductRepository interface {
	CreateProductWithRecipes(ctx context.Context, product *Product) error
	CreateBulkProductsWithRecipes(ctx context.Context, products []*Product) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*Product, error)
	GetByID(ctx context.Context, id string) (*Product, error)
	DeleteProduct(ctx context.Context, id string) error
	UpdateProductWithRecipes(ctx context.Context, product *Product) error
}

type UpdateProductRequest struct {
	Name       string                       `json:"name"`
	Price      float64                      `json:"price"`
	ImageURL   string                       `json:"image_url"`
	CategoryID *string                      `json:"category_id"`
	Recipes    []CreateProductRecipeRequest `json:"recipes"`
}

type ProductService interface {
	Create(ctx context.Context, businessID, outletID string, req *CreateProductRequest) (*Product, error)
	CreateBulk(ctx context.Context, businessID, outletID string, reqs []*CreateProductRequest) ([]*Product, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*Product, error)
	Update(ctx context.Context, businessID, productID string, req *UpdateProductRequest) (*Product, error)
	Delete(ctx context.Context, businessID, productID string) error
}

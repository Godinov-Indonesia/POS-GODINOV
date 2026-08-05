package domain

import (
	"context"
	"time"
)

type ProductCategory struct {
	ID          string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID    string    `json:"outlet_id" gorm:"column:outlet_id"`
	Name        string    `json:"name" gorm:"column:name"`
	Description string    `json:"description" gorm:"column:description"`
	IsDeleted   bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt   time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CreateProductCategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ProductCategoryRepository interface {
	Create(ctx context.Context, category *ProductCategory) error
	CreateBulk(ctx context.Context, categories []*ProductCategory) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*ProductCategory, error)
	GetByID(ctx context.Context, id string) (*ProductCategory, error)
}

type ProductCategoryService interface {
	Create(ctx context.Context, businessID, outletID string, req *CreateProductCategoryRequest) (*ProductCategory, error)
	CreateBulk(ctx context.Context, businessID, outletID string, reqs []*CreateProductCategoryRequest) ([]*ProductCategory, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*ProductCategory, error)
}

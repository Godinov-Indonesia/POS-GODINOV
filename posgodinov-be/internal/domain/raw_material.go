package domain

import (
	"context"
	"time"
)

type RawMaterial struct {
	ID          string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID    string    `json:"outlet_id" gorm:"column:outlet_id"`
	Name        string    `json:"name" gorm:"column:name"`
	Unit               string    `json:"unit" gorm:"column:unit"` // Base unit, e.g., "gram"
	PackageUnit        *string   `json:"package_unit" gorm:"column:package_unit"` // E.g., "kaleng"
	QuantityPerPackage *float64  `json:"quantity_per_package" gorm:"column:quantity_per_package"` // E.g., 370
	Stock              float64   `json:"stock" gorm:"column:stock"`
	CostPerUnit        float64   `json:"cost_per_unit" gorm:"column:cost_per_unit"`
	IsDeleted   bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt   time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt   time.Time `json:"updated_at,omitzero" gorm:"column:updated_at"`
}

type CreateRawMaterialRequest struct {
	Name               string   `json:"name"`
	Unit               string   `json:"unit"`
	PackageUnit        *string  `json:"package_unit"`
	QuantityPerPackage *float64 `json:"quantity_per_package"`
	Stock              float64  `json:"stock"`
	CostPerUnit        float64  `json:"cost_per_unit"`
}

type RawMaterialRepository interface {
	Create(ctx context.Context, rawMaterial *RawMaterial) error
	CreateBulk(ctx context.Context, rawMaterials []*RawMaterial) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*RawMaterial, error)
	GetByID(ctx context.Context, id string) (*RawMaterial, error)
	GetByIDs(ctx context.Context, ids []string) (map[string]*RawMaterial, error)
	LockByID(ctx context.Context, id string) (*RawMaterial, error)
	LockByIDs(ctx context.Context, ids []string) (map[string]*RawMaterial, error)
	UpdateStock(ctx context.Context, id string, newStock float64) error
	UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error
	Update(ctx context.Context, rm *RawMaterial) error
	Delete(ctx context.Context, id string) error
}

type UpdateRawMaterialRequest struct {
	Name               string   `json:"name"`
	Unit               string   `json:"unit"`
	PackageUnit        *string  `json:"package_unit"`
	QuantityPerPackage *float64 `json:"quantity_per_package"`
	CostPerUnit        float64  `json:"cost_per_unit"`
}

type RawMaterialService interface {
	Create(ctx context.Context, businessID, outletID string, req *CreateRawMaterialRequest) (*RawMaterial, error)
	CreateBulk(ctx context.Context, businessID, outletID string, reqs []*CreateRawMaterialRequest) ([]*RawMaterial, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*RawMaterial, error)
	Update(ctx context.Context, businessID, rmID string, req *UpdateRawMaterialRequest) (*RawMaterial, error)
	Delete(ctx context.Context, businessID, rmID string) error
}

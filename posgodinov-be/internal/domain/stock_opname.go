package domain

import (
	"context"
	"time"
)

type StockOpname struct {
	ID            string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID      string    `json:"outlet_id" gorm:"column:outlet_id"`
	RawMaterialID string    `json:"raw_material_id" gorm:"column:raw_material_id"`
	SystemStock   float64   `json:"system_stock" gorm:"column:system_stock"`
	ActualStock   float64   `json:"actual_stock" gorm:"column:actual_stock"`
	Difference    float64   `json:"difference" gorm:"column:difference"`
	FraudFlag             bool      `json:"fraud_flag" gorm:"column:fraud_flag"`
	RecordedBy            string    `json:"recorded_by" gorm:"column:recorded_by"`
	InputType             string    `json:"input_type" gorm:"column:input_type"`                         // base_unit, package_unit
	SystemPackageQuantity float64   `json:"system_package_quantity" gorm:"column:system_package_quantity"` // calculated
	ActualPackageQuantity float64   `json:"actual_package_quantity" gorm:"column:actual_package_quantity"` // input if package_unit
	DifferenceValue       float64   `json:"difference_value" gorm:"column:difference_value"`               // rupiah value
	Notes                 string    `json:"notes" gorm:"column:notes"`
	CreatedAt             time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CreateStockOpnameRequest struct {
	InputType   string  `json:"input_type"` // "base_unit" atau "package_unit"
	ActualStock float64 `json:"actual_stock"`
	Notes       string  `json:"notes"`
}

type CreateBulkStockOpnameRequest struct {
	RawMaterialID string  `json:"raw_material_id"`
	InputType     string  `json:"input_type"`
	ActualStock   float64 `json:"actual_stock"`
	Notes         string  `json:"notes"`
}

type StockOpnameRepository interface {
	Create(ctx context.Context, opname *StockOpname) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*StockOpname, error)
}

type StockOpnameService interface {
	RecordOpname(ctx context.Context, businessID, outletID, rmID, staffID string, req *CreateStockOpnameRequest) (*StockOpname, error)
	RecordBulkOpname(ctx context.Context, businessID, outletID, staffID string, reqs []*CreateBulkStockOpnameRequest) ([]*StockOpname, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*StockOpname, error)
}

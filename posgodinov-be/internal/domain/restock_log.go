package domain

import (
	"context"
	"time"
)

type RestockLog struct {
	ID            string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID      string    `json:"outlet_id" gorm:"column:outlet_id"`
	RawMaterialID string    `json:"raw_material_id" gorm:"column:raw_material_id"`
	Quantity      float64   `json:"quantity" gorm:"column:quantity"`
	CostPerUnit   float64   `json:"cost_per_unit" gorm:"column:cost_per_unit"`
	TotalCost     float64   `json:"total_cost" gorm:"column:total_cost"`
	SupplierName  string    `json:"supplier_name" gorm:"column:supplier_name"`
	RecordedBy    string    `json:"recorded_by" gorm:"column:recorded_by"`
	CreatedAt     time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CreateRestockLogRequest struct {
	Quantity     float64 `json:"quantity"`
	CostPerUnit  float64 `json:"cost_per_unit"`
	SupplierName string  `json:"supplier_name"`
}

type CreateBulkRestockLogRequest struct {
	RawMaterialID string  `json:"raw_material_id"`
	Quantity      float64 `json:"quantity"`
	CostPerUnit   float64 `json:"cost_per_unit"`
	SupplierName  string  `json:"supplier_name"`
}

type RestockLogRepository interface {
	Create(ctx context.Context, log *RestockLog) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*RestockLog, error)
}

type RestockLogService interface {
	RecordRestock(ctx context.Context, businessID, outletID, rmID, staffID string, req *CreateRestockLogRequest) (*RestockLog, error)
	RecordBulkRestock(ctx context.Context, businessID, outletID, staffID string, reqs []*CreateBulkRestockLogRequest) ([]*RestockLog, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*RestockLog, error)
}

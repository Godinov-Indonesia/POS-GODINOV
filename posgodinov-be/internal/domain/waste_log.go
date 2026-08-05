package domain

import (
	"context"
	"time"
)

type WasteLog struct {
	ID            string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID      string    `json:"outlet_id" gorm:"column:outlet_id"`
	RawMaterialID string    `json:"raw_material_id" gorm:"column:raw_material_id"`
	Quantity      float64   `json:"quantity" gorm:"column:quantity"`
	Reason        string    `json:"reason" gorm:"column:reason"`
	RecordedBy    string    `json:"recorded_by" gorm:"column:recorded_by"`
	CreatedAt     time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CreateWasteLogRequest struct {
	Quantity float64 `json:"quantity"`
	Reason   string  `json:"reason"`
}

type CreateBulkWasteLogRequest struct {
	RawMaterialID string  `json:"raw_material_id"`
	Quantity      float64 `json:"quantity"`
	Reason        string  `json:"reason"`
}

type WasteLogRepository interface {
	Create(ctx context.Context, log *WasteLog) error
	GetAllByOutletID(ctx context.Context, outletID string) ([]*WasteLog, error)
}

type WasteLogService interface {
	RecordWaste(ctx context.Context, businessID, outletID, rmID, staffID string, req *CreateWasteLogRequest) (*WasteLog, error)
	RecordBulkWaste(ctx context.Context, businessID, outletID, staffID string, reqs []*CreateBulkWasteLogRequest) ([]*WasteLog, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*WasteLog, error)
}

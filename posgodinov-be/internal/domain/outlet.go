package domain

import (
	"context"
	"time"
)

type Outlet struct {
	ID           string    `json:"id" gorm:"primaryKey;column:id"`
	BusinessID   string    `json:"business_id" gorm:"column:business_id"`
	SerialTenant string    `json:"serial_tenant" gorm:"column:serial_tenant"`
	Name         string    `json:"name" gorm:"column:name"`
	Address      string    `json:"address" gorm:"column:address"`
	IsDeleted    bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt    time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CreateOutletRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

type OutletRepository interface {
	Create(ctx context.Context, outlet *Outlet) error
	CountByBusinessID(ctx context.Context, businessID string) (int64, error)
	GetAllByBusinessID(ctx context.Context, businessID string) ([]*Outlet, error)
	GetBySerialTenant(ctx context.Context, businessID, serial string) (*Outlet, error)
	GetByID(ctx context.Context, id string) (*Outlet, error)
}

type OutletService interface {
	Register(ctx context.Context, businessID string, req *CreateOutletRequest) (*Outlet, error)
	GetAll(ctx context.Context, businessID string) ([]*Outlet, error)
}

package domain

import (
	"context"
	"time"
)

type StaffRole string

const (
	RoleCashier StaffRole = "CASHIER"
	RoleAdmin   StaffRole = "ADMIN"
)

// Staff maps to the 'users' table in database
type Staff struct {
	ID              string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID        string    `json:"outlet_id" gorm:"column:outlet_id"`
	StaffIdentifier string    `json:"staff_identifier" gorm:"column:staff_identifier"`
	Email           *string   `json:"email" gorm:"column:email"`
	Name            string    `json:"name" gorm:"column:name"`
	PINHash         string    `json:"-" gorm:"column:pin_hash"` // Never return PIN in JSON
	Role            StaffRole `json:"role" gorm:"column:role"`
	IsActive        bool      `json:"is_active" gorm:"column:is_active"`
	IsDeleted       bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

// TableName overrides GORM's default table name pluralization
func (Staff) TableName() string {
	return "users"
}

type CreateStaffRequest struct {
	OutletID        string  `json:"outlet_id"`
	StaffIdentifier string  `json:"staff_identifier"`
	Email           *string `json:"email"`
	Name            string  `json:"name"`
	PIN             string  `json:"pin"`
}

type StaffRepository interface {
	Create(ctx context.Context, staff *Staff) error
	GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*Staff, error)
	GetByID(ctx context.Context, id string) (*Staff, error)
	GetAllByOutletID(ctx context.Context, outletID string) ([]*Staff, error)
	GetAllByBusinessID(ctx context.Context, businessID string) ([]*Staff, error)
	Update(ctx context.Context, staff *Staff) error
	Delete(ctx context.Context, id string) error
}

type UpdateStaffRequest struct {
	StaffIdentifier string  `json:"staff_identifier"`
	Email           *string `json:"email"`
	Name            string  `json:"name"`
	IsActive        *bool   `json:"is_active"`
}

type StaffService interface {
	RegisterStaff(ctx context.Context, businessID string, req *CreateStaffRequest) (*Staff, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*Staff, error)
	UpdateStaff(ctx context.Context, businessID, staffID string, req *UpdateStaffRequest) (*Staff, error)
	GetAllByBusiness(ctx context.Context, businessID string) ([]*Staff, error)
	DeleteStaff(ctx context.Context, businessID, staffID string) error
}

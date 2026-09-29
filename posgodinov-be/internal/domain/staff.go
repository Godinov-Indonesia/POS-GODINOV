package domain

import (
	"context"
	"time"
)

type StaffRole string

const (
	RoleCashier     StaffRole = "CASHIER"
	RoleSupervisor  StaffRole = "SUPERVISOR"
	RoleManager     StaffRole = "MANAGER"
	RoleStockKeeper StaffRole = "STOCK_KEEPER"
	RoleAdmin       StaffRole = "ADMIN"
)

func IsValidRole(r StaffRole) bool {
	switch r {
	case RoleCashier, RoleSupervisor, RoleManager, RoleStockKeeper, RoleAdmin:
		return true
	}
	return false
}

func IsValidPermission(p string) bool {
	switch p {
	case PermissionVoidApprove, PermissionReturnApprove, PermissionKioskExit, PermissionOpnameCount, PermissionForceClose:
		return true
	}
	return false
}

// Staff maps to the 'users' table in database
type Staff struct {
	ID              string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	OutletID        string    `json:"outlet_id" gorm:"column:outlet_id"`
	StaffIdentifier string    `json:"staff_identifier" gorm:"column:staff_identifier"`
	Email           *string   `json:"email" gorm:"column:email"`
	Name            string    `json:"name" gorm:"column:name"`
	PINHash         string    `json:"-" gorm:"column:pin_hash"` // Never return PIN in JSON
	Role            StaffRole `json:"role" gorm:"column:role"`
	// v2 · butir 4, 12, 14 — izin granular di atas peran. Dikirim ke perangkat
	// lewat master data agar otorisasi dapat diputuskan OFFLINE ([11 §4.4]).
	Permissions     StringList `json:"permissions" gorm:"column:permissions"`
	IsActive        bool      `json:"is_active" gorm:"column:is_active"`
	IsDeleted       bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

// TableName overrides GORM's default table name pluralization
func (Staff) TableName() string {
	return "users"
}

type CreateStaffRequest struct {
	OutletID        string     `json:"outlet_id"`
	StaffIdentifier string     `json:"staff_identifier"`
	Email           *string    `json:"email"`
	Name            string     `json:"name"`
	PIN             string     `json:"pin"`
	Role            StaffRole  `json:"role"`
	Permissions     StringList `json:"permissions"`
}

type StaffRepository interface {
	Create(ctx context.Context, staff *Staff) error
	GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*Staff, error)
	GetByID(ctx context.Context, id string) (*Staff, error)
	GetAllByOutletID(ctx context.Context, outletID string) ([]*Staff, error)
	GetAllByBusinessID(ctx context.Context, businessID string) ([]*Staff, error)
	Update(ctx context.Context, staff *Staff) error
	Delete(ctx context.Context, id string) error
	HasActiveShift(ctx context.Context, staffID string) (bool, error)
}

type UpdateStaffRequest struct {
	StaffIdentifier string      `json:"staff_identifier"`
	Email           *string     `json:"email"`
	Name            string      `json:"name"`
	Role            *StaffRole  `json:"role"`
	Permissions     *StringList `json:"permissions"`
	IsActive        *bool       `json:"is_active"`
}

type TransferStaffRequest struct {
	TargetOutletID  string  `json:"target_outlet_id"`
	StaffIdentifier *string `json:"staff_identifier,omitempty"`
}

type StaffService interface {
	RegisterStaff(ctx context.Context, businessID string, req *CreateStaffRequest) (*Staff, error)
	GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*Staff, error)
	UpdateStaff(ctx context.Context, businessID, staffID string, req *UpdateStaffRequest) (*Staff, error)
	TransferStaff(ctx context.Context, businessID, staffID string, req *TransferStaffRequest) (*Staff, error)
	GetAllByBusiness(ctx context.Context, businessID string) ([]*Staff, error)
	DeleteStaff(ctx context.Context, businessID, staffID string) error
}


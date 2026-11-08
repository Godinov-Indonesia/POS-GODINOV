package domain

import (
	"context"
	"time"
)

type POSMobileCredential struct {
	ID         string     `json:"id" gorm:"primaryKey;column:id"`
	Code       string     `json:"code" gorm:"column:code;uniqueIndex"`
	Label      string     `json:"label" gorm:"column:label"`
	Notes      string     `json:"notes,omitempty" gorm:"column:notes"`
	BusinessID *string    `json:"business_id,omitempty" gorm:"column:business_id"`
	IsActive   bool       `json:"is_active" gorm:"column:is_active"`
	UsageCount int        `json:"usage_count" gorm:"column:usage_count"`
	MaxUsage   int        `json:"max_usage" gorm:"column:max_usage"` // 0 = unlimited
	LastUsedAt *time.Time `json:"last_used_at,omitempty" gorm:"column:last_used_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty" gorm:"column:expires_at"`
	CreatedBy  *string    `json:"created_by,omitempty" gorm:"column:created_by"`
	CreatedAt  time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt  time.Time  `json:"updated_at,omitzero" gorm:"column:updated_at"`
}

func (POSMobileCredential) TableName() string { return "pos_mobile_credentials" }

type CreatePOSMobileCredentialRequest struct {
	Code       string     `json:"code,omitempty"`        // Opsional: jika kosong, dibuatkan otomatis oleh server
	Label      string     `json:"label"`                 // Label / nama peruntukan kredensial (wajib)
	Notes      string     `json:"notes,omitempty"`       // Catatan
	BusinessID *string    `json:"business_id,omitempty"` // Opsional: batas khusus ke tenant tertentu
	IsActive   *bool      `json:"is_active,omitempty"`   // Default true
	MaxUsage   int        `json:"max_usage,omitempty"`   // 0 = unlimited
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`  // Tanggal kadaluarsa opsional
}

type UpdatePOSMobileCredentialRequest struct {
	Label      *string    `json:"label,omitempty"`
	Notes      *string    `json:"notes,omitempty"`
	BusinessID *string    `json:"business_id,omitempty"`
	IsActive   *bool      `json:"is_active,omitempty"`
	MaxUsage   *int       `json:"max_usage,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
}

type VerifyPOSMobileCredentialRequest struct {
	Key       string `json:"key,omitempty"`
	Code      string `json:"code,omitempty"`
	SerialKey string `json:"serial_key,omitempty"`
}

type VerifyPOSMobileCredentialResponse struct {
	Valid        bool                 `json:"valid"`
	Message      string               `json:"message"`
	CredentialID string               `json:"credential_id,omitempty"`
	Label        string               `json:"label,omitempty"`
	BusinessID   *string              `json:"business_id,omitempty"`
	Credential   *POSMobileCredential `json:"credential,omitempty"`
}

type POSMobileCredentialRepository interface {
	Create(ctx context.Context, cred *POSMobileCredential) error
	GetByID(ctx context.Context, id string) (*POSMobileCredential, error)
	GetByCode(ctx context.Context, code string) (*POSMobileCredential, error)
	List(ctx context.Context, search string, isActive *bool, page, limit int) ([]POSMobileCredential, int64, error)
	Update(ctx context.Context, cred *POSMobileCredential) error
	Delete(ctx context.Context, id string) error
	IncrementUsage(ctx context.Context, id string) error
}

type POSMobileCredentialService interface {
	Create(ctx context.Context, adminID string, req *CreatePOSMobileCredentialRequest) (*POSMobileCredential, error)
	GetByID(ctx context.Context, id string) (*POSMobileCredential, error)
	List(ctx context.Context, search string, isActive *bool, page, limit int) ([]POSMobileCredential, int64, error)
	Update(ctx context.Context, adminID, id string, req *UpdatePOSMobileCredentialRequest) (*POSMobileCredential, error)
	Delete(ctx context.Context, adminID, id string) error
	Verify(ctx context.Context, code string) (*VerifyPOSMobileCredentialResponse, error)
}

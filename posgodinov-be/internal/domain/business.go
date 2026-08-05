package domain

import (
	"context"
	"time"
)

type Business struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id"`
	SerialBusiness string    `json:"serial_business" gorm:"column:serial_business"`
	Email          string    `json:"email" gorm:"column:email"`
	Password       string    `json:"-" gorm:"column:password"`
	Name           string    `json:"name" gorm:"column:name"`
	OwnerName      string    `json:"owner_name" gorm:"column:owner_name"`
	IsDeleted      bool      `json:"-" gorm:"column:is_deleted;default:false"`
	CreatedAt      time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}



type RegisterBusinessRequest struct {
	Name                 string `json:"name"`
	OwnerName            string `json:"owner_name"`
	Email                string `json:"email"`
	Password             string `json:"password"`
	ConfirmationPassword string `json:"confirmation_password"`
}

type RegisterBusinessResponse struct {
	Business     *Business `json:"business"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
}

type LoginBusinessRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginBusinessResponse struct {
	Business     *Business `json:"business"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type BusinessRepository interface {
	Create(ctx context.Context, business *Business) error
	GetByEmail(ctx context.Context, email string) (*Business, error)
	GetBySerialBusiness(ctx context.Context, serial string) (*Business, error)
	GetByID(ctx context.Context, id string) (*Business, error)
	LockByID(ctx context.Context, id string) (*Business, error)
}

type BusinessService interface {
	Register(ctx context.Context, req *RegisterBusinessRequest) (*RegisterBusinessResponse, error)
	Login(ctx context.Context, req *LoginBusinessRequest) (*LoginBusinessResponse, error)
	RefreshToken(ctx context.Context, req *RefreshTokenRequest) (*RefreshTokenResponse, error)
}

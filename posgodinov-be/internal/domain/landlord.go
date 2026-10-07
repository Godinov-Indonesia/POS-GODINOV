package domain

import (
	"context"
	"time"
)

type LandlordUser struct {
	ID           string     `json:"id" gorm:"primaryKey;column:id"`
	Name         string     `json:"name" gorm:"column:name"`
	Email        string     `json:"email" gorm:"column:email"`
	PasswordHash string     `json:"-" gorm:"column:password_hash"`
	Role         string     `json:"role" gorm:"column:role"` // SUPERADMIN, FINANCE, SUPPORT
	IsActive     bool       `json:"is_active" gorm:"column:is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty" gorm:"column:last_login_at"`
	CreatedAt    time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type LandlordAuditLog struct {
	ID         string    `json:"id" gorm:"primaryKey;column:id"`
	UserID     string    `json:"user_id" gorm:"column:user_id"`
	Action     string    `json:"action" gorm:"column:action"`
	TargetType string    `json:"target_type" gorm:"column:target_type"`
	TargetID   string    `json:"target_id" gorm:"column:target_id"`
	Metadata   JSONB     `json:"metadata" gorm:"column:metadata;type:jsonb"`
	IPAddress  string    `json:"ip_address,omitempty" gorm:"column:ip_address"`
	CreatedAt  time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type LandingPageSetting struct {
	Key         string    `json:"key" gorm:"primaryKey;column:key"`
	Value       JSONB     `json:"value" gorm:"column:value;type:jsonb"`
	Description string    `json:"description" gorm:"column:description"`
	UpdatedAt   time.Time `json:"updated_at,omitzero" gorm:"column:updated_at"`
	UpdatedBy   *string   `json:"updated_by,omitempty" gorm:"column:updated_by"`
}

type LandingHeroBanner struct {
	ID                string     `json:"id" gorm:"primaryKey;column:id"`
	Title             string     `json:"title" gorm:"column:title"`
	Subtitle          string     `json:"subtitle" gorm:"column:subtitle"`
	Tagline           string     `json:"tagline" gorm:"column:tagline"`
	ImageDesktopURL   string     `json:"image_desktop_url" gorm:"column:image_desktop_url"`
	ImageMobileURL    string     `json:"image_mobile_url,omitempty" gorm:"column:image_mobile_url"`
	PrimaryCTAText    string     `json:"primary_cta_text" gorm:"column:primary_cta_text"`
	PrimaryCTAURL     string     `json:"primary_cta_url" gorm:"column:primary_cta_url"`
	SecondaryCTAText  string     `json:"secondary_cta_text" gorm:"column:secondary_cta_text"`
	SecondaryCTAURL   string     `json:"secondary_cta_url" gorm:"column:secondary_cta_url"`
	StartsAt          time.Time  `json:"starts_at" gorm:"column:starts_at"`
	EndsAt            *time.Time `json:"ends_at,omitempty" gorm:"column:ends_at"`
	SortOrder         int        `json:"sort_order" gorm:"column:sort_order"`
	IsActive          bool       `json:"is_active" gorm:"column:is_active"`
	CreatedAt         time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type LandingFAQ struct {
	ID        string    `json:"id" gorm:"primaryKey;column:id"`
	Question  string    `json:"question" gorm:"column:question"`
	Answer    string    `json:"answer" gorm:"column:answer"`
	Category  string    `json:"category" gorm:"column:category"`
	SortOrder int       `json:"sort_order" gorm:"column:sort_order"`
	IsActive  bool      `json:"is_active" gorm:"column:is_active"`
	CreatedAt time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type SystemAnnouncement struct {
	ID         string    `json:"id" gorm:"primaryKey;column:id"`
	Title      string    `json:"title" gorm:"column:title"`
	Message    string    `json:"message" gorm:"column:message"`
	Severity   string    `json:"severity" gorm:"column:severity"`
	TargetTier string    `json:"target_tier" gorm:"column:target_tier"`
	IsActive   bool      `json:"is_active" gorm:"column:is_active"`
	StartsAt   time.Time `json:"starts_at" gorm:"column:starts_at"`
	EndsAt     time.Time `json:"ends_at" gorm:"column:ends_at"`
	CreatedAt  time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type LandlordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LandlordLoginResponse struct {
	AccessToken string        `json:"access_token"`
	User        *LandlordUser `json:"user"`
}

type ImpersonateResponse struct {
	AccessToken string    `json:"access_token"`
	ExpiresIn   int64     `json:"expires_in"` // seconds (1800s / 30m)
	Business    *Business `json:"business"`
}

type BusinessWithSubscription struct {
	ID             string     `json:"id"`
	SerialBusiness string     `json:"serial_business"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	OwnerName      string     `json:"owner_name"`
	PlanID         string     `json:"plan_id"`
	PlanCode       string     `json:"plan_code"`
	PlanName       string     `json:"plan_name"`
	SubStatus      string     `json:"subscription_status"`
	ExpiresAt      *time.Time `json:"subscription_expires_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type BusinessDetailResponse struct {
	Business     *Business               `json:"business"`
	Subscription *Subscription           `json:"subscription"`
	Wallet       *MerchantWallet         `json:"wallet"`
	Overrides    []TenantFeatureOverride `json:"overrides"`
	Policy       *EffectivePolicy        `json:"effective_policy"`
}

type LandlordMetricsOverview struct {
	TotalBusinesses     int64            `json:"total_businesses"`
	ActiveBusinesses    int64            `json:"active_businesses"`
	SuspendedBusinesses int64            `json:"suspended_businesses"`
	BusinessesByPlan    map[string]int64 `json:"businesses_by_plan"`
	EstimatedMRRMinor   int64            `json:"estimated_mrr_minor"`
}

type LandlordRepository interface {
	GetUserByEmail(ctx context.Context, email string) (*LandlordUser, error)
	GetUserByID(ctx context.Context, id string) (*LandlordUser, error)
	CreateAuditLog(ctx context.Context, log *LandlordAuditLog) error
	GetLandingSettings(ctx context.Context) ([]LandingPageSetting, error)
	GetLandingSettingByKey(ctx context.Context, key string) (*LandingPageSetting, error)
	UpsertLandingSetting(ctx context.Context, setting *LandingPageSetting) error
	GetActiveHeroBanners(ctx context.Context) ([]LandingHeroBanner, error)
	GetActiveFAQs(ctx context.Context) ([]LandingFAQ, error)
	GetActiveAnnouncements(ctx context.Context) ([]SystemAnnouncement, error)

	// Manajemen Tenant & Direktori
	ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*BusinessWithSubscription, int64, error)
	GetBusinessDetail(ctx context.Context, businessID string) (*Business, *Subscription, *MerchantWallet, []TenantFeatureOverride, error)
	SetBusinessSubscriptionStatus(ctx context.Context, businessID string, status string) error
	GetMetricsOverview(ctx context.Context) (*LandlordMetricsOverview, error)
}

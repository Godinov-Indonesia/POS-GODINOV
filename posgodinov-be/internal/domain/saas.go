package domain

import (
	"context"
	"time"
)

type SaaSFeature struct {
	Key         string    `json:"key" gorm:"primaryKey;column:key"`
	Name        string    `json:"name" gorm:"column:name"`
	Description string    `json:"description" gorm:"column:description"`
	Category    string    `json:"category" gorm:"column:category"` // CORE, INVENTORY, STAFF, REPORTS, INTEGRATION
	ValueType   string    `json:"value_type" gorm:"column:value_type"` // NUMERIC_LIMIT, BOOLEAN_FLAG
	Unit        *string   `json:"unit,omitempty" gorm:"column:unit"`
	SortOrder   int       `json:"sort_order" gorm:"column:sort_order"`
	IsActive    bool      `json:"is_active" gorm:"column:is_active"`
	CreatedAt   time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type Plan struct {
	ID           string        `json:"id" gorm:"primaryKey;column:id"`
	Code         string        `json:"code" gorm:"column:code"`
	Name         string        `json:"name" gorm:"column:name"`
	Description  string        `json:"description" gorm:"column:description"`
	PriceMinor   int64         `json:"price_minor" gorm:"column:price_minor"`
	BillingCycle string        `json:"billing_cycle" gorm:"column:billing_cycle"`
	IsPublic     bool          `json:"is_public" gorm:"column:is_public"`
	IsActive     bool          `json:"is_active" gorm:"column:is_active"`
	SortOrder    int           `json:"sort_order" gorm:"column:sort_order"`
	CreatedAt    time.Time     `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt    time.Time     `json:"updated_at,omitzero" gorm:"column:updated_at"`
	Features     []PlanFeature `json:"features,omitempty" gorm:"foreignKey:PlanID"`
}

type PlanFeature struct {
	ID          string       `json:"id" gorm:"primaryKey;column:id"`
	PlanID      string       `json:"plan_id" gorm:"column:plan_id"`
	FeatureKey  string       `json:"feature_key" gorm:"column:feature_key"`
	IsEnabled   bool         `json:"is_enabled" gorm:"column:is_enabled"`
	LimitValue  int64        `json:"limit_value" gorm:"column:limit_value"` // -1 = Unlimited
	ExtraConfig JSONB        `json:"extra_config" gorm:"column:extra_config;type:jsonb"`
	UpdatedAt   time.Time    `json:"updated_at,omitzero" gorm:"column:updated_at"`
	Feature     *SaaSFeature `json:"feature,omitempty" gorm:"foreignKey:FeatureKey"`
}

type Subscription struct {
	ID         string     `json:"id" gorm:"primaryKey;column:id"`
	BusinessID string     `json:"business_id" gorm:"column:business_id"`
	PlanID     string     `json:"plan_id" gorm:"column:plan_id"`
	Status     string     `json:"status" gorm:"column:status"` // ACTIVE, TRIAL, PAST_DUE, EXPIRED
	StartedAt  time.Time  `json:"started_at" gorm:"column:started_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty" gorm:"column:expires_at"` // nil = lifetime
	AutoRenew  bool       `json:"auto_renew" gorm:"column:auto_renew"`
	CreatedAt  time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt  time.Time  `json:"updated_at,omitzero" gorm:"column:updated_at"`
	Plan       *Plan      `json:"plan,omitempty" gorm:"foreignKey:PlanID"`
}

type TenantFeatureOverride struct {
	ID           string     `json:"id" gorm:"primaryKey;column:id"`
	BusinessID   string     `json:"business_id" gorm:"column:business_id"`
	FeatureKey   string     `json:"feature_key" gorm:"column:feature_key"`
	OverrideType string     `json:"override_type" gorm:"column:override_type"` // ADD_LIMIT, SET_LIMIT, ENABLE_FLAG, DISABLE_FLAG
	ValueBool    *bool      `json:"value_bool,omitempty" gorm:"column:value_bool"`
	ValueNumeric *int64     `json:"value_numeric,omitempty" gorm:"column:value_numeric"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty" gorm:"column:expires_at"`
	Reason       string     `json:"reason,omitempty" gorm:"column:reason"`
	CreatedBy    *string    `json:"created_by,omitempty" gorm:"column:created_by"`
	CreatedAt    time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type SubscriptionLog struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id"`
	SubscriptionID string    `json:"subscription_id" gorm:"column:subscription_id"`
	BusinessID     string    `json:"business_id" gorm:"column:business_id"`
	Event          string    `json:"event" gorm:"column:event"`
	FromPlanID     *string   `json:"from_plan_id,omitempty" gorm:"column:from_plan_id"`
	ToPlanID       string    `json:"to_plan_id" gorm:"column:to_plan_id"`
	Remarks        string    `json:"remarks,omitempty" gorm:"column:remarks"`
	CreatedAt      time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type SaaSCampaign struct {
	ID               string     `json:"id" gorm:"primaryKey;column:id"`
	Title            string     `json:"title" gorm:"column:title"`
	Subtitle         string     `json:"subtitle,omitempty" gorm:"column:subtitle"`
	Format           string     `json:"format" gorm:"column:format"` // POPUP_MODAL, CAROUSEL_SLIDE, HEADER_BANNER
	Placement        string     `json:"placement" gorm:"column:placement"`
	ImageURL         string     `json:"image_url" gorm:"column:image_url"`
	ActionType       string     `json:"action_type" gorm:"column:action_type"` // INTERNAL_UPGRADE, EXTERNAL_URL, INFO_ONLY
	ActionURL        string     `json:"action_url,omitempty" gorm:"column:action_url"`
	ActionLabel      string     `json:"action_label" gorm:"column:action_label"`
	TargetTier       string     `json:"target_tier" gorm:"column:target_tier"` // FREE_ONLY, ALL
	Priority         int        `json:"priority" gorm:"column:priority"`
	SkipDelaySeconds int        `json:"skip_delay_seconds" gorm:"column:skip_delay_seconds"`
	StartsAt         time.Time  `json:"starts_at" gorm:"column:starts_at"`
	EndsAt           *time.Time `json:"ends_at,omitempty" gorm:"column:ends_at"`
	IsActive         bool       `json:"is_active" gorm:"column:is_active"`
	ImpressionCount  int64      `json:"impression_count" gorm:"column:impression_count"`
	ClickCount       int64      `json:"click_count" gorm:"column:click_count"`
	CreatedAt        time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type MerchantWallet struct {
	ID               string    `json:"id" gorm:"primaryKey;column:id"`
	BusinessID       string    `json:"business_id" gorm:"column:business_id"`
	BalanceMinor     int64     `json:"balance_minor" gorm:"column:balance_minor"`
	HeldBalanceMinor int64     `json:"held_balance_minor" gorm:"column:held_balance_minor"`
	PayoutBankCode   *string   `json:"payout_bank_code,omitempty" gorm:"column:payout_bank_code"`
	PayoutAccountNo  *string   `json:"payout_account_no,omitempty" gorm:"column:payout_account_no"`
	PayoutAccountName *string  `json:"payout_account_name,omitempty" gorm:"column:payout_account_name"`
	IsFrozen         bool      `json:"is_frozen" gorm:"column:is_frozen"`
	UpdatedAt        time.Time `json:"updated_at,omitzero" gorm:"column:updated_at"`
}

type SubscriptionInvoice struct {
	ID               string     `json:"id" gorm:"primaryKey;column:id"`
	BusinessID       string     `json:"business_id" gorm:"column:business_id"`
	SubscriptionID   string     `json:"subscription_id" gorm:"column:subscription_id"`
	InvoiceNumber    string     `json:"invoice_number" gorm:"uniqueIndex;column:invoice_number"`
	PlanID           string     `json:"plan_id" gorm:"column:plan_id"`
	BillingCycle     string     `json:"billing_cycle" gorm:"column:billing_cycle"`
	AmountMinor      int64      `json:"amount_minor" gorm:"column:amount_minor"`
	TaxMinor         int64      `json:"tax_minor" gorm:"column:tax_minor"`
	TotalMinor       int64      `json:"total_minor" gorm:"column:total_minor"`
	Status           string     `json:"status" gorm:"column:status"` // PENDING, PAID, EXPIRED, FAILED
	PaymentGateway   string     `json:"payment_gateway" gorm:"column:payment_gateway"`
	GatewayReference string     `json:"gateway_reference" gorm:"column:gateway_reference"`
	PaymentMethod    string     `json:"payment_method" gorm:"column:payment_method"`
	PaymentURL       string     `json:"payment_url" gorm:"column:payment_url"`
	VANumber         string     `json:"va_number" gorm:"column:va_number"`
	QRPayload        string     `json:"qr_payload" gorm:"column:qr_payload"`
	PaidAt           *time.Time `json:"paid_at,omitempty" gorm:"column:paid_at"`
	ExpiredAt        time.Time  `json:"expired_at" gorm:"column:expired_at"`
	CreatedAt        time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type CheckoutSubscriptionRequest struct {
	PlanID        string `json:"plan_id"`
	PaymentMethod string `json:"payment_method"` // WALLET, QRIS, VA
}

type CheckoutSubscriptionResponse struct {
	PaymentMethod    string `json:"payment_method"`
	Status           string `json:"status"` // PAID, PENDING
	InvoiceNumber    string `json:"invoice_number,omitempty"`
	GatewayReference string `json:"gateway_reference,omitempty"`
	PaymentURL       string `json:"payment_url,omitempty"`
	QRPayload        string `json:"qr_payload,omitempty"`
	VANumber         string `json:"va_number,omitempty"`
}

// EffectivePolicy memetakan hasil evaluasi gabungan base plan + tenant overrides
type EffectivePolicy struct {
	PlanCode     string           `json:"plan_code"`
	PlanName     string           `json:"plan_name"`
	Status       string           `json:"status"`
	NumericLimit map[string]int64 `json:"numeric_limits"`
	BooleanFlags map[string]bool  `json:"boolean_flags"`
	CachedAt     time.Time        `json:"cached_at"`
}

// SaaSRepository mendefinisikan operasi basis data Landlord untuk SaaS
type SaaSRepository interface {
	// Fitur & Paket
	ListFeatures(ctx context.Context) ([]SaaSFeature, error)
	ListPlans(ctx context.Context, publicOnly bool) ([]Plan, error)
	GetPlanByID(ctx context.Context, id string) (*Plan, error)
	GetPlanByCode(ctx context.Context, code string) (*Plan, error)
	UpdatePlanFeature(ctx context.Context, pf *PlanFeature) error
	GetBusinessIDsByPlanID(ctx context.Context, planID string) ([]string, error)

	// Langganan Tenant
	GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*Subscription, error)
	CreateSubscription(ctx context.Context, sub *Subscription) error
	UpdateSubscription(ctx context.Context, sub *Subscription) error
	CreateSubscriptionLog(ctx context.Context, log *SubscriptionLog) error
	ListSubscriptionsExpiredBefore(ctx context.Context, t time.Time, status string) ([]*Subscription, error)
	BulkUpdateSubscriptionStatus(ctx context.Context, ids []string, status string) error

	// Overrides
	ListActiveOverrides(ctx context.Context, businessID string) ([]TenantFeatureOverride, error)
	CreateOverride(ctx context.Context, override *TenantFeatureOverride) error
	DeleteOverride(ctx context.Context, id string) error

	// Dompet Merchant
	CreateWallet(ctx context.Context, wallet *MerchantWallet) error
	GetWalletByBusinessID(ctx context.Context, businessID string) (*MerchantWallet, error)
	UpdateWallet(ctx context.Context, wallet *MerchantWallet) error

	// Invoices
	CreateInvoice(ctx context.Context, inv *SubscriptionInvoice) error
	GetInvoiceByReference(ctx context.Context, gatewayRef string) (*SubscriptionInvoice, error)
	UpdateInvoiceStatus(ctx context.Context, id string, status string, paidAt *time.Time) error

	// Kampanye Iklan
	ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]SaaSCampaign, error)
	GetCampaignByID(ctx context.Context, id string) (*SaaSCampaign, error)
	IncrementCampaignClick(ctx context.Context, id string) error
	CreateCampaign(ctx context.Context, campaign *SaaSCampaign) error
}

// PolicyEngine mendefinisikan evaluator kuota & fitur berbasis in-memory cache
type PolicyEngine interface {
	GetEffectivePolicy(ctx context.Context, businessID string) (*EffectivePolicy, error)
	AssertQuota(ctx context.Context, businessID, featureKey string, currentUsage int64) error
	AssertFeature(ctx context.Context, businessID, featureKey string) error
	GetNumericLimit(ctx context.Context, businessID, featureKey string) (int64, error)
	InvalidateCache(businessID string)
	InvalidatePlan(ctx context.Context, planID string) error
}

// DunningService mendefinisikan background job untuk penanganan masa tenggang (grace period) dan downgrade
type DunningService interface {
	RunDunningCheck(ctx context.Context) error
}

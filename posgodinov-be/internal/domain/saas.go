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
	UpdatePlanFeature(ctx context.Context, pf *PlanFeature) error

	// Langganan Tenant
	GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*Subscription, error)
	CreateSubscription(ctx context.Context, sub *Subscription) error
	UpdateSubscription(ctx context.Context, sub *Subscription) error
	CreateSubscriptionLog(ctx context.Context, log *SubscriptionLog) error

	// Overrides
	ListActiveOverrides(ctx context.Context, businessID string) ([]TenantFeatureOverride, error)
	CreateOverride(ctx context.Context, override *TenantFeatureOverride) error
	DeleteOverride(ctx context.Context, id string) error

	// Dompet Merchant
	CreateWallet(ctx context.Context, wallet *MerchantWallet) error
	GetWalletByBusinessID(ctx context.Context, businessID string) (*MerchantWallet, error)

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
}

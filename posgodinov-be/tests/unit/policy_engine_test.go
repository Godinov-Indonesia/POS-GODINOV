package unit

import (
	"context"
	"testing"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type mockSaaSRepository struct {
	sub       *domain.Subscription
	overrides []domain.TenantFeatureOverride
	campaigns []domain.SaaSCampaign
}

func (m *mockSaaSRepository) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	return nil, nil
}

func (m *mockSaaSRepository) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) {
	return nil, nil
}

func (m *mockSaaSRepository) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) {
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.ID == id {
		return m.sub.Plan, nil
	}
	return nil, nil
}

func (m *mockSaaSRepository) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error {
	return nil
}

func (m *mockSaaSRepository) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
	return m.sub, nil
}

func (m *mockSaaSRepository) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.sub = sub
	return nil
}

func (m *mockSaaSRepository) UpdateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.sub = sub
	return nil
}

func (m *mockSaaSRepository) CreateSubscriptionLog(ctx context.Context, log *domain.SubscriptionLog) error {
	return nil
}

func (m *mockSaaSRepository) ListActiveOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) {
	return m.overrides, nil
}

func (m *mockSaaSRepository) CreateOverride(ctx context.Context, override *domain.TenantFeatureOverride) error {
	m.overrides = append(m.overrides, *override)
	return nil
}

func (m *mockSaaSRepository) DeleteOverride(ctx context.Context, id string) error {
	for i, o := range m.overrides {
		if o.ID == id {
			m.overrides = append(m.overrides[:i], m.overrides[i+1:]...)
			return nil
		}
	}
	return nil
}

func (m *mockSaaSRepository) CreateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	return nil
}

func (m *mockSaaSRepository) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	return nil, nil
}

func (m *mockSaaSRepository) ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) {
	return m.campaigns, nil
}

func (m *mockSaaSRepository) GetCampaignByID(ctx context.Context, id string) (*domain.SaaSCampaign, error) {
	return nil, nil
}

func (m *mockSaaSRepository) IncrementCampaignClick(ctx context.Context, id string) error {
	return nil
}

func (m *mockSaaSRepository) CreateCampaign(ctx context.Context, campaign *domain.SaaSCampaign) error {
	m.campaigns = append(m.campaigns, *campaign)
	return nil
}

func makeFreeTierSubscription(businessID string) *domain.Subscription {
	return &domain.Subscription{
		ID:         "sub-1",
		BusinessID: businessID,
		PlanID:     "plan_free",
		Status:     "ACTIVE",
		Plan: &domain.Plan{
			ID:   "plan_free",
			Code: "FREE",
			Name: "Free Tier",
			Features: []domain.PlanFeature{
				{FeatureKey: "max_outlets", LimitValue: 1, IsEnabled: true},
				{FeatureKey: "max_products", LimitValue: 50, IsEnabled: true},
				{FeatureKey: "max_raw_materials", LimitValue: 50, IsEnabled: true},
				{FeatureKey: "max_staff_per_outlet", LimitValue: 2, IsEnabled: true},
				{FeatureKey: "history_days_limit", LimitValue: 30, IsEnabled: true},
				{FeatureKey: "staff_transfer", LimitValue: 0, IsEnabled: false},
				{FeatureKey: "no_ads", LimitValue: 0, IsEnabled: false},
			},
		},
	}
}

func TestPolicyEngine_BasePlanLimits(t *testing.T) {
	ctx := context.Background()
	bizID := "BIZ00001"
	sub := makeFreeTierSubscription(bizID)
	repo := &mockSaaSRepository{sub: sub}
	engine := service.NewPolicyEngine(repo)

	// max_outlets limit is 1
	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 1); err != nil {
		t.Fatalf("expected 1 outlet allowed, got error: %v", err)
	}

	err := engine.AssertQuota(ctx, bizID, "max_outlets", 2)
	if err == nil {
		t.Fatal("expected quota exceeded error for 2 outlets on Free Tier, got nil")
	}
	var quotaErr *service.QuotaExceededError
	if !isQuotaError(err, &quotaErr) || quotaErr.FeatureKey != "max_outlets" {
		t.Fatalf("expected QuotaExceededError for max_outlets, got %v", err)
	}

	// staff_transfer is disabled on Free Tier
	if err := engine.AssertFeature(ctx, bizID, "staff_transfer"); err == nil {
		t.Fatal("expected feature disabled error for staff_transfer on Free Tier, got nil")
	}

	// history_days_limit is 30
	limit, err := engine.GetNumericLimit(ctx, bizID, "history_days_limit")
	if err != nil || limit != 30 {
		t.Fatalf("expected history_days_limit 30, got %d (err: %v)", limit, err)
	}
}

func TestPolicyEngine_TenantOverrides(t *testing.T) {
	ctx := context.Background()
	bizID := "BIZ00001"
	sub := makeFreeTierSubscription(bizID)
	repo := &mockSaaSRepository{sub: sub}
	engine := service.NewPolicyEngine(repo)

	// Awalnya batas outlet adalah 1
	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 2); err == nil {
		t.Fatal("expected quota exceeded for 2 outlets before override")
	}

	// Tambah override ADD_LIMIT (+2)
	addVal := int64(2)
	repo.overrides = append(repo.overrides, domain.TenantFeatureOverride{
		ID:           "ov-1",
		BusinessID:   bizID,
		FeatureKey:   "max_outlets",
		OverrideType: "ADD_LIMIT",
		ValueNumeric: &addVal,
	})
	engine.InvalidateCache(bizID)

	// Sekarang batas adalah 1 + 2 = 3
	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 3); err != nil {
		t.Fatalf("expected 3 outlets allowed after ADD_LIMIT override, got: %v", err)
	}
	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 4); err == nil {
		t.Fatal("expected quota exceeded for 4 outlets with total limit 3")
	}

	// Override ENABLE_FLAG untuk staff_transfer
	repo.overrides = append(repo.overrides, domain.TenantFeatureOverride{
		ID:           "ov-2",
		BusinessID:   bizID,
		FeatureKey:   "staff_transfer",
		OverrideType: "ENABLE_FLAG",
	})
	engine.InvalidateCache(bizID)

	if err := engine.AssertFeature(ctx, bizID, "staff_transfer"); err != nil {
		t.Fatalf("expected staff_transfer allowed after ENABLE_FLAG override, got: %v", err)
	}

	// Override SET_LIMIT (10)
	setVal := int64(10)
	repo.overrides = append(repo.overrides, domain.TenantFeatureOverride{
		ID:           "ov-3",
		BusinessID:   bizID,
		FeatureKey:   "max_outlets",
		OverrideType: "SET_LIMIT",
		ValueNumeric: &setVal,
	})
	engine.InvalidateCache(bizID)

	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 10); err != nil {
		t.Fatalf("expected 10 outlets allowed after SET_LIMIT override, got: %v", err)
	}
	if err := engine.AssertQuota(ctx, bizID, "max_outlets", 11); err == nil {
		t.Fatal("expected quota exceeded for 11 outlets with SET_LIMIT 10")
	}
}

func TestPolicyEngine_SuspendedTenant(t *testing.T) {
	ctx := context.Background()
	bizID := "BIZ00001"
	sub := makeFreeTierSubscription(bizID)
	sub.Status = "SUSPENDED"
	repo := &mockSaaSRepository{sub: sub}
	engine := service.NewPolicyEngine(repo)

	err := engine.AssertQuota(ctx, bizID, "max_outlets", 1)
	if err == nil {
		t.Fatal("expected error on AssertQuota for SUSPENDED tenant, got nil")
	}

	err = engine.AssertFeature(ctx, bizID, "max_outlets")
	if err == nil {
		t.Fatal("expected error on AssertFeature for SUSPENDED tenant, got nil")
	}
}

func TestPolicyEngine_CacheInvalidation(t *testing.T) {
	ctx := context.Background()
	bizID := "BIZ00001"
	sub := makeFreeTierSubscription(bizID)
	repo := &mockSaaSRepository{sub: sub}
	engine := service.NewPolicyEngine(repo)

	// Fetch policy
	pol1, err := engine.GetEffectivePolicy(ctx, bizID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Modify underlying repo without invalidating cache
	addVal := int64(5)
	repo.overrides = append(repo.overrides, domain.TenantFeatureOverride{
		ID:           "ov-1",
		BusinessID:   bizID,
		FeatureKey:   "max_outlets",
		OverrideType: "ADD_LIMIT",
		ValueNumeric: &addVal,
	})

	polCached, _ := engine.GetEffectivePolicy(ctx, bizID)
	if polCached.NumericLimit["max_outlets"] != pol1.NumericLimit["max_outlets"] {
		t.Fatal("expected cached value to remain before InvalidateCache")
	}

	// Invalidate cache
	engine.InvalidateCache(bizID)

	polUpdated, _ := engine.GetEffectivePolicy(ctx, bizID)
	if polUpdated.NumericLimit["max_outlets"] != 6 {
		t.Fatalf("expected updated limit 6 after InvalidateCache, got %d", polUpdated.NumericLimit["max_outlets"])
	}
}

func isQuotaError(err error, target **service.QuotaExceededError) bool {
	if q, ok := err.(*service.QuotaExceededError); ok {
		*target = q
		return true
	}
	return false
}

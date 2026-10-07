package unit

import (
	"context"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type mockDunningSaaSRepo struct {
	subs      map[string]*domain.Subscription
	logs      []*domain.SubscriptionLog
	freePlan  *domain.Plan
}

func newMockDunningSaaSRepo() *mockDunningSaaSRepo {
	return &mockDunningSaaSRepo{
		subs: make(map[string]*domain.Subscription),
		freePlan: &domain.Plan{
			ID:   "plan_free",
			Code: "FREE",
			Name: "Free Tier",
		},
	}
}

func (m *mockDunningSaaSRepo) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) {
	if m.freePlan != nil && m.freePlan.ID == id {
		return m.freePlan, nil
	}
	return nil, nil
}
func (m *mockDunningSaaSRepo) GetPlanByCode(ctx context.Context, code string) (*domain.Plan, error) {
	if m.freePlan != nil && m.freePlan.Code == code {
		return m.freePlan, nil
	}
	return nil, nil
}
func (m *mockDunningSaaSRepo) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error {
	return nil
}
func (m *mockDunningSaaSRepo) GetBusinessIDsByPlanID(ctx context.Context, planID string) ([]string, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
	for _, s := range m.subs {
		if s.BusinessID == businessID {
			return s, nil
		}
	}
	return nil, nil
}
func (m *mockDunningSaaSRepo) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.subs[sub.ID] = sub
	return nil
}
func (m *mockDunningSaaSRepo) UpdateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.subs[sub.ID] = sub
	return nil
}
func (m *mockDunningSaaSRepo) CreateSubscriptionLog(ctx context.Context, log *domain.SubscriptionLog) error {
	m.logs = append(m.logs, log)
	return nil
}
func (m *mockDunningSaaSRepo) ListSubscriptionsExpiredBefore(ctx context.Context, t time.Time, status string) ([]*domain.Subscription, error) {
	var result []*domain.Subscription
	for _, s := range m.subs {
		if s.Status == status && s.ExpiresAt != nil && !s.ExpiresAt.After(t) {
			result = append(result, s)
		}
	}
	return result, nil
}
func (m *mockDunningSaaSRepo) BulkUpdateSubscriptionStatus(ctx context.Context, ids []string, status string) error {
	for _, id := range ids {
		if s, ok := m.subs[id]; ok {
			s.Status = status
		}
	}
	return nil
}
func (m *mockDunningSaaSRepo) ListActiveOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) CreateOverride(ctx context.Context, override *domain.TenantFeatureOverride) error {
	return nil
}
func (m *mockDunningSaaSRepo) DeleteOverride(ctx context.Context, id string) error {
	return nil
}
func (m *mockDunningSaaSRepo) CreateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	return nil
}
func (m *mockDunningSaaSRepo) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) UpdateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	return nil
}
func (m *mockDunningSaaSRepo) CreateInvoice(ctx context.Context, inv *domain.SubscriptionInvoice) error {
	return nil
}
func (m *mockDunningSaaSRepo) GetInvoiceByReference(ctx context.Context, gatewayRef string) (*domain.SubscriptionInvoice, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) UpdateInvoiceStatus(ctx context.Context, id string, status string, paidAt *time.Time) error {
	return nil
}
func (m *mockDunningSaaSRepo) ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) GetCampaignByID(ctx context.Context, id string) (*domain.SaaSCampaign, error) {
	return nil, nil
}
func (m *mockDunningSaaSRepo) IncrementCampaignClick(ctx context.Context, id string) error {
	return nil
}
func (m *mockDunningSaaSRepo) CreateCampaign(ctx context.Context, campaign *domain.SaaSCampaign) error {
	return nil
}

type mockDunningPolicyEngine struct {
	invalidatedTenants []string
}

func (m *mockDunningPolicyEngine) GetEffectivePolicy(ctx context.Context, businessID string) (*domain.EffectivePolicy, error) {
	return nil, nil
}
func (m *mockDunningPolicyEngine) AssertQuota(ctx context.Context, businessID, featureKey string, currentUsage int64) error {
	return nil
}
func (m *mockDunningPolicyEngine) AssertFeature(ctx context.Context, businessID, featureKey string) error {
	return nil
}
func (m *mockDunningPolicyEngine) GetNumericLimit(ctx context.Context, businessID, featureKey string) (int64, error) {
	return 0, nil
}
func (m *mockDunningPolicyEngine) InvalidateCache(businessID string) {
	m.invalidatedTenants = append(m.invalidatedTenants, businessID)
}
func (m *mockDunningPolicyEngine) InvalidatePlan(ctx context.Context, planID string) error {
	return nil
}

func TestDunningService_ActiveToPastDue(t *testing.T) {
	repo := newMockDunningSaaSRepo()
	policy := &mockDunningPolicyEngine{}
	dunning := service.NewDunningService(repo, policy)

	now := time.Now()
	expiredAt := now.Add(-2 * time.Hour)

	sub := &domain.Subscription{
		ID:         "sub-1",
		BusinessID: "biz-1",
		PlanID:     "plan_pro",
		Status:     "ACTIVE",
		ExpiresAt:  &expiredAt,
	}
	repo.subs[sub.ID] = sub

	err := dunning.RunDunningCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Status != "PAST_DUE" {
		t.Fatalf("expected status PAST_DUE, got %s", sub.Status)
	}

	if len(repo.logs) != 1 || repo.logs[0].Event != "STATUS_CHANGED" {
		t.Fatalf("expected 1 STATUS_CHANGED log, got %+v", repo.logs)
	}

	if len(policy.invalidatedTenants) != 1 || policy.invalidatedTenants[0] != "biz-1" {
		t.Fatalf("expected cache invalidated for biz-1, got %v", policy.invalidatedTenants)
	}
}

func TestDunningService_ActiveNotExpired_Untouched(t *testing.T) {
	repo := newMockDunningSaaSRepo()
	policy := &mockDunningPolicyEngine{}
	dunning := service.NewDunningService(repo, policy)

	now := time.Now()
	validUntil := now.Add(48 * time.Hour)

	sub := &domain.Subscription{
		ID:         "sub-active",
		BusinessID: "biz-active",
		PlanID:     "plan_pro",
		Status:     "ACTIVE",
		ExpiresAt:  &validUntil,
	}
	repo.subs[sub.ID] = sub

	err := dunning.RunDunningCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Status != "ACTIVE" {
		t.Fatalf("expected status to remain ACTIVE, got %s", sub.Status)
	}
	if len(repo.logs) != 0 {
		t.Fatalf("expected no logs created, got %d", len(repo.logs))
	}
}

func TestDunningService_PastDueWithinGracePeriod_NotDowngraded(t *testing.T) {
	repo := newMockDunningSaaSRepo()
	policy := &mockDunningPolicyEngine{}
	dunning := service.NewDunningService(repo, policy)

	now := time.Now()
	expiredAt := now.Add(-3 * 24 * time.Hour) // 3 days ago (within 7 days grace)

	sub := &domain.Subscription{
		ID:         "sub-grace",
		BusinessID: "biz-grace",
		PlanID:     "plan_pro",
		Status:     "PAST_DUE",
		ExpiresAt:  &expiredAt,
	}
	repo.subs[sub.ID] = sub

	err := dunning.RunDunningCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Status != "PAST_DUE" {
		t.Fatalf("expected status to remain PAST_DUE during grace period, got %s", sub.Status)
	}
	if sub.PlanID != "plan_pro" {
		t.Fatalf("expected plan_id to remain plan_pro, got %s", sub.PlanID)
	}
}

func TestDunningService_PastDueExceededGracePeriod_DowngradesToFree(t *testing.T) {
	repo := newMockDunningSaaSRepo()
	policy := &mockDunningPolicyEngine{}
	dunning := service.NewDunningService(repo, policy)

	now := time.Now()
	expiredAt := now.Add(-8 * 24 * time.Hour) // 8 days ago (> 7 days grace)

	sub := &domain.Subscription{
		ID:         "sub-expired",
		BusinessID: "biz-expired",
		PlanID:     "plan_pro",
		Status:     "PAST_DUE",
		ExpiresAt:  &expiredAt,
	}
	repo.subs[sub.ID] = sub

	err := dunning.RunDunningCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sub.Status != "EXPIRED" {
		t.Fatalf("expected status EXPIRED, got %s", sub.Status)
	}
	if sub.PlanID != "plan_free" {
		t.Fatalf("expected plan_id plan_free, got %s", sub.PlanID)
	}
	if sub.ExpiresAt != nil {
		t.Fatalf("expected expires_at nil for free tier, got %v", sub.ExpiresAt)
	}

	if len(repo.logs) != 1 || repo.logs[0].Event != "DOWNGRADED" {
		t.Fatalf("expected 1 DOWNGRADED log, got %+v", repo.logs)
	}
	if len(policy.invalidatedTenants) != 1 || policy.invalidatedTenants[0] != "biz-expired" {
		t.Fatalf("expected cache invalidated for biz-expired, got %v", policy.invalidatedTenants)
	}
}

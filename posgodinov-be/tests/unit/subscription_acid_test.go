package unit

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/adapter"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

// snapshottingTxManager menduplikasi state sebelum menjalankan callback.
// Jika terjadi error, state dikembalikan (rollback). Jika sukses, state dipertahankan (commit).
type snapshottingTxManager struct {
	onRollback func()
	txCalls    int
}

func (s *snapshottingTxManager) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	s.txCalls++
	err := fn(ctx)
	if err != nil && s.onRollback != nil {
		s.onRollback()
	}
	return err
}

type mockACIDSaaSRepo struct {
	plan               *domain.Plan
	sub                *domain.Subscription
	wallet             *domain.MerchantWallet
	invoice            *domain.SubscriptionInvoice
	logs               []*domain.SubscriptionLog
	failOnCreateInv    bool
	failOnUpdateSub    bool
}

func (m *mockACIDSaaSRepo) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) { return nil, nil }
func (m *mockACIDSaaSRepo) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) { return nil, nil }
func (m *mockACIDSaaSRepo) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) { return m.plan, nil }
func (m *mockACIDSaaSRepo) GetPlanByCode(ctx context.Context, code string) (*domain.Plan, error) { return m.plan, nil }
func (m *mockACIDSaaSRepo) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error { return nil }
func (m *mockACIDSaaSRepo) GetBusinessIDsByPlanID(ctx context.Context, planID string) ([]string, error) { return nil, nil }

func (m *mockACIDSaaSRepo) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
	return m.sub, nil
}
func (m *mockACIDSaaSRepo) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.sub = sub
	return nil
}
func (m *mockACIDSaaSRepo) UpdateSubscription(ctx context.Context, sub *domain.Subscription) error {
	if m.failOnUpdateSub {
		return errors.New("db error updating subscription")
	}
	m.sub = sub
	return nil
}
func (m *mockACIDSaaSRepo) CreateSubscriptionLog(ctx context.Context, log *domain.SubscriptionLog) error {
	m.logs = append(m.logs, log)
	return nil
}
func (m *mockACIDSaaSRepo) ListSubscriptionsExpiredBefore(ctx context.Context, t time.Time, status string) ([]*domain.Subscription, error) {
	return nil, nil
}
func (m *mockACIDSaaSRepo) BulkUpdateSubscriptionStatus(ctx context.Context, ids []string, status string) error { return nil }
func (m *mockACIDSaaSRepo) ListActiveOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) { return nil, nil }
func (m *mockACIDSaaSRepo) CreateOverride(ctx context.Context, override *domain.TenantFeatureOverride) error { return nil }
func (m *mockACIDSaaSRepo) DeleteOverride(ctx context.Context, id string) error { return nil }
func (m *mockACIDSaaSRepo) CreateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	m.wallet = wallet
	return nil
}
func (m *mockACIDSaaSRepo) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	return m.wallet, nil
}
func (m *mockACIDSaaSRepo) UpdateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	m.wallet = wallet
	return nil
}
func (m *mockACIDSaaSRepo) CreateInvoice(ctx context.Context, inv *domain.SubscriptionInvoice) error {
	if m.failOnCreateInv {
		return errors.New("db error creating invoice")
	}
	m.invoice = inv
	return nil
}
func (m *mockACIDSaaSRepo) GetInvoiceByReference(ctx context.Context, gatewayRef string) (*domain.SubscriptionInvoice, error) {
	return m.invoice, nil
}
func (m *mockACIDSaaSRepo) UpdateInvoiceStatus(ctx context.Context, id string, status string, paidAt *time.Time) error {
	if m.invoice != nil {
		m.invoice.Status = status
		m.invoice.PaidAt = paidAt
	}
	return nil
}
func (m *mockACIDSaaSRepo) ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) { return nil, nil }
func (m *mockACIDSaaSRepo) GetCampaignByID(ctx context.Context, id string) (*domain.SaaSCampaign, error) { return nil, nil }
func (m *mockACIDSaaSRepo) IncrementCampaignClick(ctx context.Context, id string) error { return nil }
func (m *mockACIDSaaSRepo) CreateCampaign(ctx context.Context, campaign *domain.SaaSCampaign) error { return nil }
func (m *mockACIDSaaSRepo) RecordCampaignClick(ctx context.Context, campaignID string) error { return nil }

type mockACIDPolicyEngine struct {
	invalidatedTenants []string
}

func (p *mockACIDPolicyEngine) GetEffectivePolicy(ctx context.Context, businessID string) (*domain.EffectivePolicy, error) { return nil, nil }
func (p *mockACIDPolicyEngine) AssertQuota(ctx context.Context, businessID, featureKey string, currentUsage int64) error { return nil }
func (p *mockACIDPolicyEngine) AssertFeature(ctx context.Context, businessID, featureKey string) error { return nil }
func (p *mockACIDPolicyEngine) GetNumericLimit(ctx context.Context, businessID, featureKey string) (int64, error) { return -1, nil }
func (p *mockACIDPolicyEngine) InvalidateCache(businessID string) {
	p.invalidatedTenants = append(p.invalidatedTenants, businessID)
}
func (p *mockACIDPolicyEngine) InvalidatePlan(ctx context.Context, planID string) error { return nil }

func TestSubscriptionACID_WalletCheckoutRollback(t *testing.T) {
	ctx := context.Background()
	bizID := "biz_acid_1"

	proPlan := &domain.Plan{
		ID:           "plan_pro",
		Code:         "PRO",
		Name:         "Pro Plan",
		PriceMinor:   10000000,
		BillingCycle: "MONTHLY",
	}

	origWallet := &domain.MerchantWallet{
		ID:           "w1",
		BusinessID:   bizID,
		BalanceMinor: 20000000,
	}

	origSub := &domain.Subscription{
		ID:         "sub1",
		BusinessID: bizID,
		PlanID:     "plan_free",
		Status:     "ACTIVE",
	}

	repo := &mockACIDSaaSRepo{
		plan:            proPlan,
		wallet:          &domain.MerchantWallet{ID: origWallet.ID, BusinessID: origWallet.BusinessID, BalanceMinor: origWallet.BalanceMinor},
		sub:             &domain.Subscription{ID: origSub.ID, BusinessID: origSub.BusinessID, PlanID: origSub.PlanID, Status: origSub.Status},
		failOnCreateInv: true, // Simulasikan kegagalan DB di langkah ketiga
	}

	txMgr := &snapshottingTxManager{
		onRollback: func() {
			// Pulihkan wallet dan subscription saat rollback
			repo.wallet.BalanceMinor = origWallet.BalanceMinor
			repo.sub.PlanID = origSub.PlanID
			repo.sub.Status = origSub.Status
		},
	}

	policyEngine := &mockACIDPolicyEngine{}
	svc := service.NewLandlordService(
		nil,
		repo,
		nil,
		nil,
		policyEngine,
		service.WithLandlordTxManager(txMgr),
	)

	_, err := svc.CheckoutSubscription(ctx, bizID, &domain.CheckoutSubscriptionRequest{
		PlanID:        "plan_pro",
		PaymentMethod: "WALLET",
	})

	if err == nil {
		t.Fatal("expected error during checkout when CreateInvoice fails, got nil")
	}

	if txMgr.txCalls != 1 {
		t.Fatalf("expected txManager.WithTransaction to be called once, got %d", txMgr.txCalls)
	}

	// Verifikasi Rollback: saldo wallet kembali utuh
	if repo.wallet.BalanceMinor != origWallet.BalanceMinor {
		t.Fatalf("expected wallet balance rolled back to %d, got %d", origWallet.BalanceMinor, repo.wallet.BalanceMinor)
	}

	// Verifikasi Rollback: subscription plan tetap plan_free
	if repo.sub.PlanID != "plan_free" {
		t.Fatalf("expected subscription plan to remain plan_free, got %s", repo.sub.PlanID)
	}

	// Verifikasi Invalidation: cache TIDAK diinvalidasi karena transaksi gagal
	if len(policyEngine.invalidatedTenants) > 0 {
		t.Fatalf("expected no cache invalidation on rollback, got %v", policyEngine.invalidatedTenants)
	}
}

func TestSubscriptionACID_PaymentWebhookRollback(t *testing.T) {
	ctx := context.Background()
	bizID := "biz_acid_2"

	inv := &domain.SubscriptionInvoice{
		ID:               "inv_acid_1",
		BusinessID:       bizID,
		SubscriptionID:   "sub2",
		InvoiceNumber:    "INV-001",
		PlanID:           "plan_pro",
		Status:           "PENDING",
		GatewayReference: "REF-001",
	}

	origSub := &domain.Subscription{
		ID:         "sub2",
		BusinessID: bizID,
		PlanID:     "plan_free",
		Status:     "ACTIVE",
	}

	repo := &mockACIDSaaSRepo{
		invoice:         &domain.SubscriptionInvoice{ID: inv.ID, BusinessID: inv.BusinessID, SubscriptionID: inv.SubscriptionID, InvoiceNumber: inv.InvoiceNumber, PlanID: inv.PlanID, Status: inv.Status, GatewayReference: inv.GatewayReference},
		sub:             &domain.Subscription{ID: origSub.ID, BusinessID: origSub.BusinessID, PlanID: origSub.PlanID, Status: origSub.Status},
		failOnUpdateSub: true, // Simulasikan kegagalan saat update subscription
	}

	txMgr := &snapshottingTxManager{
		onRollback: func() {
			repo.invoice.Status = "PENDING"
			repo.sub.PlanID = origSub.PlanID
		},
	}

	policyEngine := &mockACIDPolicyEngine{}
	paymentHub := adapter.NewMockPaymentHubAdapter()

	svc := service.NewLandlordService(
		nil,
		repo,
		nil,
		nil,
		policyEngine,
		service.WithLandlordPaymentHub(paymentHub),
		service.WithLandlordTxManager(txMgr),
	)

	payload := domain.PaymentHubWebhookPayload{
		Event:       "payment.settled",
		ReferenceID: "REF-001",
		AmountMinor: 11100000,
		BusinessID:  bizID,
	}
	body, _ := json.Marshal(payload)
	httpReq := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewBuffer(body))

	err := svc.HandlePaymentWebhook(ctx, httpReq)
	if err == nil {
		t.Fatal("expected error during webhook processing when UpdateSubscription fails, got nil")
	}

	if txMgr.txCalls != 1 {
		t.Fatalf("expected txManager.WithTransaction to be called once, got %d", txMgr.txCalls)
	}

	// Verifikasi Rollback: invoice status tetap PENDING (tidak jadi PAID)
	if repo.invoice.Status != "PENDING" {
		t.Fatalf("expected invoice status to remain PENDING after rollback, got %s", repo.invoice.Status)
	}

	// Verifikasi Rollback: subscription plan tetap plan_free
	if repo.sub.PlanID != "plan_free" {
		t.Fatalf("expected subscription plan to remain plan_free, got %s", repo.sub.PlanID)
	}

	// Verifikasi Invalidation: cache TIDAK diinvalidasi karena transaksi gagal
	if len(policyEngine.invalidatedTenants) > 0 {
		t.Fatalf("expected no cache invalidation on rollback, got %v", policyEngine.invalidatedTenants)
	}
}

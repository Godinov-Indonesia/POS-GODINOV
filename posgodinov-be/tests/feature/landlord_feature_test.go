package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/adapter"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type mockFeatureLandlordRepo struct {
	users         []*domain.LandlordUser
	auditLogs     []*domain.LandlordAuditLog
	subStatus     map[string]string
	metrics       *domain.LandlordMetricsOverview
}

func (m *mockFeatureLandlordRepo) GetUserByEmail(ctx context.Context, email string) (*domain.LandlordUser, error) {
	for _, u := range m.users {
		if u.Email == email && u.IsActive {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockFeatureLandlordRepo) GetUserByID(ctx context.Context, id string) (*domain.LandlordUser, error) {
	for _, u := range m.users {
		if u.ID == id && u.IsActive {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockFeatureLandlordRepo) CreateAuditLog(ctx context.Context, log *domain.LandlordAuditLog) error {
	m.auditLogs = append(m.auditLogs, log)
	return nil
}

func (m *mockFeatureLandlordRepo) GetLandingSettings(ctx context.Context) ([]domain.LandingPageSetting, error) {
	return nil, nil
}

func (m *mockFeatureLandlordRepo) GetLandingSettingByKey(ctx context.Context, key string) (*domain.LandingPageSetting, error) {
	return nil, nil
}

func (m *mockFeatureLandlordRepo) UpsertLandingSetting(ctx context.Context, setting *domain.LandingPageSetting) error {
	return nil
}

func (m *mockFeatureLandlordRepo) GetActiveHeroBanners(ctx context.Context) ([]domain.LandingHeroBanner, error) {
	return nil, nil
}

func (m *mockFeatureLandlordRepo) GetActiveFAQs(ctx context.Context) ([]domain.LandingFAQ, error) {
	return nil, nil
}

func (m *mockFeatureLandlordRepo) GetActiveAnnouncements(ctx context.Context) ([]domain.SystemAnnouncement, error) {
	return nil, nil
}

func (m *mockFeatureLandlordRepo) ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*domain.BusinessWithSubscription, int64, error) {
	return nil, 0, nil
}

func (m *mockFeatureLandlordRepo) GetBusinessDetail(ctx context.Context, businessID string) (*domain.Business, *domain.Subscription, *domain.MerchantWallet, []domain.TenantFeatureOverride, error) {
	return nil, nil, nil, nil, nil
}

func (m *mockFeatureLandlordRepo) SetBusinessSubscriptionStatus(ctx context.Context, businessID string, status string) error {
	if m.subStatus == nil {
		m.subStatus = make(map[string]string)
	}
	m.subStatus[businessID] = status
	return nil
}

func (m *mockFeatureLandlordRepo) GetMetricsOverview(ctx context.Context) (*domain.LandlordMetricsOverview, error) {
	return m.metrics, nil
}

type mockFeatureSaaSRepo struct {
	sub       *domain.Subscription
	overrides []domain.TenantFeatureOverride
	campaigns []domain.SaaSCampaign
	wallet    *domain.MerchantWallet
	invoices  map[string]*domain.SubscriptionInvoice
	plans     map[string]*domain.Plan
}

func (m *mockFeatureSaaSRepo) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	return nil, nil
}

func (m *mockFeatureSaaSRepo) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) {
	return nil, nil
}

func (m *mockFeatureSaaSRepo) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) {
	if m.plans != nil {
		if p, ok := m.plans[id]; ok {
			return p, nil
		}
	}
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.ID == id {
		return m.sub.Plan, nil
	}
	return nil, nil
}

func (m *mockFeatureSaaSRepo) GetPlanByCode(ctx context.Context, code string) (*domain.Plan, error) {
	if m.plans != nil {
		for _, p := range m.plans {
			if p.Code == code {
				return p, nil
			}
		}
	}
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.Code == code {
		return m.sub.Plan, nil
	}
	return nil, nil
}

func (m *mockFeatureSaaSRepo) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error {
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.ID == pf.PlanID {
		for i, f := range m.sub.Plan.Features {
			if f.FeatureKey == pf.FeatureKey {
				m.sub.Plan.Features[i].IsEnabled = pf.IsEnabled
				m.sub.Plan.Features[i].LimitValue = pf.LimitValue
				return nil
			}
		}
		m.sub.Plan.Features = append(m.sub.Plan.Features, *pf)
	}
	return nil
}

func (m *mockFeatureSaaSRepo) GetBusinessIDsByPlanID(ctx context.Context, planID string) ([]string, error) {
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.ID == planID {
		return []string{m.sub.BusinessID}, nil
	}
	return nil, nil
}

func (m *mockFeatureSaaSRepo) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
	if m.sub != nil && m.plans != nil {
		if p, ok := m.plans[m.sub.PlanID]; ok {
			m.sub.Plan = p
		}
	}
	return m.sub, nil
}

func (m *mockFeatureSaaSRepo) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.sub = sub
	return nil
}

func (m *mockFeatureSaaSRepo) UpdateSubscription(ctx context.Context, sub *domain.Subscription) error {
	m.sub = sub
	return nil
}

func (m *mockFeatureSaaSRepo) CreateSubscriptionLog(ctx context.Context, log *domain.SubscriptionLog) error {
	return nil
}

func (m *mockFeatureSaaSRepo) ListSubscriptionsExpiredBefore(ctx context.Context, t time.Time, status string) ([]*domain.Subscription, error) {
	if m.sub != nil && m.sub.Status == status && m.sub.ExpiresAt != nil && !m.sub.ExpiresAt.After(t) {
		return []*domain.Subscription{m.sub}, nil
	}
	return nil, nil
}

func (m *mockFeatureSaaSRepo) BulkUpdateSubscriptionStatus(ctx context.Context, ids []string, status string) error {
	if m.sub != nil {
		for _, id := range ids {
			if m.sub.ID == id {
				m.sub.Status = status
			}
		}
	}
	return nil
}

func (m *mockFeatureSaaSRepo) ListActiveOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) {
	return m.overrides, nil
}

func (m *mockFeatureSaaSRepo) CreateOverride(ctx context.Context, override *domain.TenantFeatureOverride) error {
	m.overrides = append(m.overrides, *override)
	return nil
}

func (m *mockFeatureSaaSRepo) DeleteOverride(ctx context.Context, id string) error {
	return nil
}

func (m *mockFeatureSaaSRepo) CreateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	m.wallet = wallet
	return nil
}

func (m *mockFeatureSaaSRepo) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	return m.wallet, nil
}

func (m *mockFeatureSaaSRepo) UpdateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	m.wallet = wallet
	return nil
}

func (m *mockFeatureSaaSRepo) CreateInvoice(ctx context.Context, inv *domain.SubscriptionInvoice) error {
	if m.invoices == nil {
		m.invoices = make(map[string]*domain.SubscriptionInvoice)
	}
	m.invoices[inv.InvoiceNumber] = inv
	if inv.GatewayReference != "" {
		m.invoices[inv.GatewayReference] = inv
	}
	return nil
}

func (m *mockFeatureSaaSRepo) GetInvoiceByReference(ctx context.Context, gatewayRef string) (*domain.SubscriptionInvoice, error) {
	if m.invoices != nil {
		if inv, ok := m.invoices[gatewayRef]; ok {
			return inv, nil
		}
	}
	return nil, errors.New("invoice tidak ditemukan")
}

func (m *mockFeatureSaaSRepo) UpdateInvoiceStatus(ctx context.Context, id string, status string, paidAt *time.Time) error {
	if m.invoices != nil {
		for _, inv := range m.invoices {
			if inv.ID == id || inv.InvoiceNumber == id || inv.GatewayReference == id {
				inv.Status = status
				inv.PaidAt = paidAt
				return nil
			}
		}
	}
	return nil
}

func (m *mockFeatureSaaSRepo) ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) {
	return m.campaigns, nil
}

func (m *mockFeatureSaaSRepo) GetCampaignByID(ctx context.Context, id string) (*domain.SaaSCampaign, error) {
	return nil, nil
}

func (m *mockFeatureSaaSRepo) IncrementCampaignClick(ctx context.Context, id string) error {
	return nil
}

func (m *mockFeatureSaaSRepo) CreateCampaign(ctx context.Context, campaign *domain.SaaSCampaign) error {
	m.campaigns = append(m.campaigns, *campaign)
	return nil
}

type mockFeatureStaffRepo struct {
	staffs []*domain.Staff
}

func (m *mockFeatureStaffRepo) Create(ctx context.Context, staff *domain.Staff) error {
	m.staffs = append(m.staffs, staff)
	return nil
}

func (m *mockFeatureStaffRepo) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) {
	for _, s := range m.staffs {
		if s.OutletID == outletID && s.StaffIdentifier == staffIdentifier {
			return s, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockFeatureStaffRepo) GetByID(ctx context.Context, id string) (*domain.Staff, error) {
	for _, s := range m.staffs {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockFeatureStaffRepo) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	var list []*domain.Staff
	for _, s := range m.staffs {
		if s.OutletID == outletID {
			list = append(list, s)
		}
	}
	return list, nil
}

func (m *mockFeatureStaffRepo) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	return m.staffs, nil
}

func (m *mockFeatureStaffRepo) Update(ctx context.Context, staff *domain.Staff) error {
	for i, s := range m.staffs {
		if s.ID == staff.ID {
			m.staffs[i] = staff
			return nil
		}
	}
	return nil
}

func (m *mockFeatureStaffRepo) Delete(ctx context.Context, id string) error {
	return nil
}

func (m *mockFeatureStaffRepo) HasActiveShift(ctx context.Context, staffID string) (bool, error) {
	return false, nil
}

func setupLandlordFeatureTest(opts ...service.LandlordOption) (
	*http.ServeMux,
	token.TokenMaker,
	*mockFeatureLandlordRepo,
	*mockFeatureSaaSRepo,
	*MockBusinessRepository,
	*MockFeatureOutletRepository,
	domain.PolicyEngine,
) {
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")

	passHash, _ := bcrypt.GenerateFromPassword([]byte("admin12345"), bcrypt.DefaultCost)
	adminUser := &domain.LandlordUser{
		ID:           "admin-1",
		Name:         "Super Admin",
		Email:        "admin@godinov.com",
		PasswordHash: string(passHash),
		Role:         "SUPERADMIN",
		IsActive:     true,
	}

	landlordRepo := &mockFeatureLandlordRepo{
		users: []*domain.LandlordUser{adminUser},
	}

	bizID := "b1"
	sub := &domain.Subscription{
		ID:         "sub-1",
		BusinessID: bizID,
		PlanID:     "plan_free",
		Status:     "ACTIVE",
		Plan: &domain.Plan{
			ID:   "plan_free",
			Code: "FREE",
			Name: "Free Tier",
			Features: []domain.PlanFeature{
				{FeatureKey: "max_outlets", LimitValue: 1, IsEnabled: true},
				{FeatureKey: "max_products", LimitValue: 50, IsEnabled: true},
				{FeatureKey: "staff_transfer", LimitValue: 0, IsEnabled: false},
			},
		},
	}

	saasRepo := &mockFeatureSaaSRepo{sub: sub}
	policyEngine := service.NewPolicyEngine(saasRepo)

	biz := &domain.Business{
		ID:             bizID,
		SerialBusiness: "POS01",
		Email:          "merchant@godinov.com",
		Name:           "Kopi Godinov",
		OwnerName:      "Budi",
	}
	bizRepo := &MockBusinessRepository{
		businesses: []*domain.Business{biz},
	}

	txManager := database.NewMockTransactionManager()
	paymentHub := adapter.NewMockPaymentHubAdapter()
	allOpts := append([]service.LandlordOption{
		service.WithLandlordPaymentHub(paymentHub),
		service.WithLandlordTxManager(txManager),
	}, opts...)
	landlordSvc := service.NewLandlordService(
		landlordRepo, saasRepo, bizRepo, tokenMaker, policyEngine,
		allOpts...,
	)
	landlordHandler := handler.NewLandlordHandler(landlordSvc)

	outletRepo := &MockFeatureOutletRepository{}
	outletSvc := service.NewOutletService(
		outletRepo, bizRepo, txManager,
		service.WithOutletPolicyEngine(policyEngine),
	)
	outletHandler := handler.NewOutletHandler(outletSvc)

	staffRepo := &mockFeatureStaffRepo{
		staffs: []*domain.Staff{
			{ID: "s1", OutletID: "o1", Name: "Staff 1", StaffIdentifier: "STF01"},
		},
	}
	staffSvc := service.NewStaffService(
		staffRepo, outletRepo,
		service.WithStaffPolicyEngine(policyEngine),
	)
	staffHandler := handler.NewStaffHandler(staffSvc)

	landlordMw := middleware.LandlordAuthMiddleware(tokenMaker)
	merchantMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/landlord/auth/login", landlordHandler.Login)
	mux.HandleFunc("GET /v1/landlord/auth/me", landlordMw(landlordHandler.GetMe))
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/impersonate", landlordMw(landlordHandler.Impersonate))
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/overrides", landlordMw(landlordHandler.CreateOverride))
	mux.HandleFunc("PUT /v1/landlord/plans/{id}/features/{feature_key}", landlordMw(landlordHandler.UpdatePlanFeature))
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/suspend", landlordMw(landlordHandler.SuspendBusiness))
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/unsuspend", landlordMw(landlordHandler.UnsuspendBusiness))
	mux.HandleFunc("POST /v1/landlord/campaigns", landlordMw(landlordHandler.CreateCampaign))
	mux.HandleFunc("PUT /v1/landlord/landing/settings/{key}", landlordMw(landlordHandler.UpdateLandingSetting))
	mux.HandleFunc("POST /v1/landlord/landing/revalidate", landlordMw(landlordHandler.RevalidateLandingPage))

	mux.HandleFunc("POST /v1/business/outlets", merchantMw(outletHandler.Register))
	mux.HandleFunc("GET /v1/business/subscription", merchantMw(landlordHandler.GetTenantSubscription))
	mux.HandleFunc("POST /v1/business/subscription/checkout", merchantMw(landlordHandler.CheckoutSubscription))
	mux.HandleFunc("POST /v1/business/staffs/{staff_id}/transfer", merchantMw(staffHandler.Transfer))
	mux.HandleFunc("POST /v1/webhooks/payment-hub", landlordHandler.HandlePaymentWebhook)

	return mux, tokenMaker, landlordRepo, saasRepo, bizRepo, outletRepo, policyEngine
}

func TestFeature_LandlordLoginAndTokenIsolation(t *testing.T) {
	mux, tokenMaker, _, _, _, _, _ := setupLandlordFeatureTest()

	// 1. Sukses login admin
	loginBody, _ := json.Marshal(domain.LandlordLoginRequest{
		Email:    "admin@godinov.com",
		Password: "admin12345",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/landlord/auth/login", bytes.NewBuffer(loginBody))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for landlord login, got %d", rr.Code)
	}

	var loginResp struct {
		Data domain.LandlordLoginResponse `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &loginResp)
	landlordToken := loginResp.Data.AccessToken

	// 2. Akses /v1/landlord/auth/me menggunakan landlord token -> 200 OK
	meReq := httptest.NewRequest(http.MethodGet, "/v1/landlord/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+landlordToken)
	meRR := httptest.NewRecorder()
	mux.ServeHTTP(meRR, meReq)
	if meRR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK accessing /v1/landlord/auth/me with landlord token, got %d", meRR.Code)
	}

	// 3. Akses /v1/landlord/auth/me menggunakan merchant access token -> 403 Forbidden
	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "merchant@godinov.com",
		Type:  "access",
	}, time.Hour)

	badReq := httptest.NewRequest(http.MethodGet, "/v1/landlord/auth/me", nil)
	badReq.Header.Set("Authorization", "Bearer "+merchantToken)
	badRR := httptest.NewRecorder()
	mux.ServeHTTP(badRR, badReq)
	if badRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when merchant accesses landlord route, got %d", badRR.Code)
	}

	// 4. Akses rute merchant dengan landlord token -> 401 Unauthorized (AuthMiddleware menolak tipe selain "access")
	merchantRouteReq := httptest.NewRequest(http.MethodGet, "/v1/business/subscription", nil)
	merchantRouteReq.Header.Set("Authorization", "Bearer "+landlordToken)
	merchantRouteRR := httptest.NewRecorder()
	mux.ServeHTTP(merchantRouteRR, merchantRouteReq)
	if merchantRouteRR.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized when landlord token accesses merchant route, got %d", merchantRouteRR.Code)
	}
}

func TestFeature_LandlordImpersonation(t *testing.T) {
	mux, tokenMaker, landlordRepo, _, _, _, _ := setupLandlordFeatureTest()

	landlordToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	req := httptest.NewRequest(http.MethodPost, "/v1/landlord/businesses/b1/impersonate", nil)
	req.SetPathValue("id", "b1")
	req.Header.Set("Authorization", "Bearer "+landlordToken)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for impersonation, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Data domain.ImpersonateResponse `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)

	// Validasi token impersonasi
	payload, err := tokenMaker.VerifyToken(resp.Data.AccessToken)
	if err != nil {
		t.Fatalf("impersonation token failed verification: %v", err)
	}
	if payload.Type != "access" || !payload.IsImpersonated || payload.ImpersonatedBy != "admin-1" {
		t.Fatalf("invalid impersonation claims: Type=%s, IsImp=%v, ImpBy=%s", payload.Type, payload.IsImpersonated, payload.ImpersonatedBy)
	}

	// Validasi audit log tercatat
	if len(landlordRepo.auditLogs) == 0 {
		t.Fatal("expected audit log to be created for impersonation")
	}
	if landlordRepo.auditLogs[0].Action != "IMPERSONATE" || landlordRepo.auditLogs[0].TargetID != "b1" {
		t.Fatalf("unexpected audit log: %+v", landlordRepo.auditLogs[0])
	}
}

func TestFeature_QuotaEnforcement_OutletRegistration(t *testing.T) {
	mux, tokenMaker, _, saasRepo, _, _, policyEngine := setupLandlordFeatureTest()

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:         "b1",
		Email:      "merchant@godinov.com",
		Type:       "access",
		BusinessID: "b1",
	}, time.Hour)

	landlordToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	// 1. Registrasi outlet pertama -> 201 Created (Batas Free Tier = 1)
	reqBody1, _ := json.Marshal(map[string]string{"name": "Outlet Pertama", "address": "Jl. Utama"})
	req1 := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(reqBody1))
	req1.Header.Set("Authorization", "Bearer "+merchantToken)
	rr1 := httptest.NewRecorder()
	mux.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for 1st outlet, got %d: %s", rr1.Code, rr1.Body.String())
	}

	// 2. Registrasi outlet kedua -> 403 Forbidden (Kuota terlampaui)
	reqBody2, _ := json.Marshal(map[string]string{"name": "Outlet Kedua", "address": "Jl. Cabang"})
	req2 := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(reqBody2))
	req2.Header.Set("Authorization", "Bearer "+merchantToken)
	rr2 := httptest.NewRecorder()
	mux.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for 2nd outlet on Free Tier, got %d: %s", rr2.Code, rr2.Body.String())
	}

	// 3. Landlord memberikan override ADD_LIMIT +1 untuk max_outlets
	addVal := int64(1)
	ovBody, _ := json.Marshal(domain.TenantFeatureOverride{
		FeatureKey:   "max_outlets",
		OverrideType: "ADD_LIMIT",
		ValueNumeric: &addVal,
	})
	ovReq := httptest.NewRequest(http.MethodPost, "/v1/landlord/businesses/b1/overrides", bytes.NewBuffer(ovBody))
	ovReq.SetPathValue("id", "b1")
	ovReq.Header.Set("Authorization", "Bearer "+landlordToken)
	ovRR := httptest.NewRecorder()
	mux.ServeHTTP(ovRR, ovReq)

	if ovRR.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for override, got %d: %s", ovRR.Code, ovRR.Body.String())
	}

	// Pastikan cache policy ter-update
	policyEngine.InvalidateCache("b1")
	_ = saasRepo

	// 4. Registrasi outlet kedua sekarang sukses -> 201 Created
	req3 := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(reqBody2))
	req3.Header.Set("Authorization", "Bearer "+merchantToken)
	rr3 := httptest.NewRecorder()
	mux.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for 2nd outlet after override, got %d: %s", rr3.Code, rr3.Body.String())
	}
}

func TestFeature_SuspendAndUnsuspendBusiness(t *testing.T) {
	mux, tokenMaker, _, saasRepo, _, _, policyEngine := setupLandlordFeatureTest()

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:         "b1",
		Email:      "merchant@godinov.com",
		Type:       "access",
		BusinessID: "b1",
	}, time.Hour)

	landlordToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	// 1. Suspend bisnis via landlord API
	suspendBody, _ := json.Marshal(map[string]string{"reason": "Pelanggaran ToS"})
	suspendReq := httptest.NewRequest(http.MethodPost, "/v1/landlord/businesses/b1/suspend", bytes.NewBuffer(suspendBody))
	suspendReq.SetPathValue("id", "b1")
	suspendReq.Header.Set("Authorization", "Bearer "+landlordToken)
	suspendRR := httptest.NewRecorder()
	mux.ServeHTTP(suspendRR, suspendReq)

	if suspendRR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for suspend, got %d", suspendRR.Code)
	}

	// Simulasikan status di mock saasRepo
	saasRepo.sub.Status = "SUSPENDED"
	policyEngine.InvalidateCache("b1")

	// 2. Merchant mencoba membuat outlet -> Ditolak karena SUSPENDED (403)
	outletBody, _ := json.Marshal(map[string]string{"name": "Outlet Cabang", "address": "Jl. Baru"})
	actReq := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(outletBody))
	actReq.Header.Set("Authorization", "Bearer "+merchantToken)
	actRR := httptest.NewRecorder()
	mux.ServeHTTP(actRR, actReq)

	if actRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for action on SUSPENDED business, got %d", actRR.Code)
	}

	// 3. Unsuspend bisnis
	unsuspendReq := httptest.NewRequest(http.MethodPost, "/v1/landlord/businesses/b1/unsuspend", nil)
	unsuspendReq.SetPathValue("id", "b1")
	unsuspendReq.Header.Set("Authorization", "Bearer "+landlordToken)
	unsuspendRR := httptest.NewRecorder()
	mux.ServeHTTP(unsuspendRR, unsuspendReq)

	if unsuspendRR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for unsuspend, got %d", unsuspendRR.Code)
	}

	saasRepo.sub.Status = "ACTIVE"
	policyEngine.InvalidateCache("b1")

	// 4. Merchant sekarang bisa membuat outlet
	actReq2 := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(outletBody))
	actReq2.Header.Set("Authorization", "Bearer "+merchantToken)
	actRR2 := httptest.NewRecorder()
	mux.ServeHTTP(actRR2, actReq2)

	if actRR2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created after unsuspend, got %d: %s", actRR2.Code, actRR2.Body.String())
	}
}

func TestFeature_StaffTransfer_FeatureGuard(t *testing.T) {
	mux, tokenMaker, _, saasRepo, _, outletRepo, policyEngine := setupLandlordFeatureTest()

	outletRepo.outlets = []*domain.Outlet{
		{ID: "o1", BusinessID: "b1", Name: "Outlet 1"},
		{ID: "o2", BusinessID: "b1", Name: "Outlet 2"},
	}

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:         "b1",
		Email:      "merchant@godinov.com",
		Type:       "access",
		BusinessID: "b1",
	}, time.Hour)

	landlordToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	// 1. Merchant di Free Tier mencoba transfer staff -> 403 Forbidden
	transferBody, _ := json.Marshal(map[string]string{
		"target_outlet_id": "o2",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/business/staffs/s1/transfer", bytes.NewBuffer(transferBody))
	req.SetPathValue("staff_id", "s1")
	req.Header.Set("Authorization", "Bearer "+merchantToken)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for staff transfer on Free Tier, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. Landlord memberikan override ENABLE_FLAG untuk staff_transfer
	ovBody, _ := json.Marshal(domain.TenantFeatureOverride{
		FeatureKey:   "staff_transfer",
		OverrideType: "ENABLE_FLAG",
	})
	ovReq := httptest.NewRequest(http.MethodPost, "/v1/landlord/businesses/b1/overrides", bytes.NewBuffer(ovBody))
	ovReq.SetPathValue("id", "b1")
	ovReq.Header.Set("Authorization", "Bearer "+landlordToken)
	ovRR := httptest.NewRecorder()
	mux.ServeHTTP(ovRR, ovReq)

	if ovRR.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for override, got %d: %s", ovRR.Code, ovRR.Body.String())
	}

	policyEngine.InvalidateCache("b1")
	_ = saasRepo

	// 3. Merchant sekarang berhasil transfer staff -> 200 OK
	req2 := httptest.NewRequest(http.MethodPost, "/v1/business/staffs/s1/transfer", bytes.NewBuffer(transferBody))
	req2.SetPathValue("staff_id", "s1")
	req2.Header.Set("Authorization", "Bearer "+merchantToken)
	rr2 := httptest.NewRecorder()
	mux.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for staff transfer after override, got %d: %s", rr2.Code, rr2.Body.String())
	}
}

func TestLandlordUpdatePlanFeature_InvalidatesPlanCache(t *testing.T) {
	mux, tokenMaker, _, _, _, _, policyEngine := setupLandlordFeatureTest()

	landlordToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	ctx := context.Background()

	// 1. Initial cached policy for tenant b1 on plan p1 has max_outlets = 1
	pol1, err := policyEngine.GetEffectivePolicy(ctx, "b1")
	if err != nil {
		t.Fatalf("unexpected error fetching initial policy: %v", err)
	}
	if pol1.NumericLimit["max_outlets"] != 1 {
		t.Fatalf("expected initial max_outlets to be 1, got %d", pol1.NumericLimit["max_outlets"])
	}

	// 2. Landlord updates plan feature for plan_free
	updateBody, _ := json.Marshal(map[string]interface{}{
		"is_enabled":  true,
		"limit_value": 3,
	})
	req := httptest.NewRequest(http.MethodPut, "/v1/landlord/plans/plan_free/features/max_outlets", bytes.NewBuffer(updateBody))
	req.SetPathValue("id", "plan_free")
	req.SetPathValue("feature_key", "max_outlets")
	req.Header.Set("Authorization", "Bearer "+landlordToken)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for update plan feature, got %d: %s", rr.Code, rr.Body.String())
	}

	// 3. Due to InvalidatePlan broadcast, cache for b1 must be evicted automatically
	pol2, err := policyEngine.GetEffectivePolicy(ctx, "b1")
	if err != nil {
		t.Fatalf("unexpected error fetching updated policy: %v", err)
	}
	if pol2.NumericLimit["max_outlets"] != 3 {
		t.Fatalf("expected updated max_outlets to be 3 after InvalidatePlan, got %d", pol2.NumericLimit["max_outlets"])
	}
}

func TestFeature_SubscriptionCheckoutWallet(t *testing.T) {
	mux, tokenMaker, _, saasRepo, _, _, policyEngine := setupLandlordFeatureTest()

	ctx := context.Background()
	bizID := "b1"

	proPlan := &domain.Plan{
		ID:           "plan_pro",
		Code:         "PRO",
		Name:         "Pro Monthly",
		PriceMinor:   10000000, // 100,000 IDR
		BillingCycle: "MONTHLY",
		Features: []domain.PlanFeature{
			{FeatureKey: "max_outlets", LimitValue: 5, IsEnabled: true},
		},
	}
	saasRepo.plans = map[string]*domain.Plan{
		"plan_pro": proPlan,
	}
	saasRepo.wallet = &domain.MerchantWallet{
		ID:           "w-1",
		BusinessID:   bizID,
		BalanceMinor: 20000000, // 200,000 IDR
	}

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    bizID,
		Email: "merchant@godinov.com",
		Role:  "OWNER",
		Type:  "access",
	}, time.Hour)

	// Pre-condition: cache policy max_outlets = 1
	polBefore, err := policyEngine.GetEffectivePolicy(ctx, bizID)
	if err != nil || polBefore.NumericLimit["max_outlets"] != 1 {
		t.Fatalf("expected max_outlets 1 before checkout, got %v", polBefore)
	}

	// 1. Checkout via WALLET
	checkoutReq, _ := json.Marshal(domain.CheckoutSubscriptionRequest{
		PlanID:        "plan_pro",
		PaymentMethod: "WALLET",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/business/subscription/checkout", bytes.NewBuffer(checkoutReq))
	req.Header.Set("Authorization", "Bearer "+merchantToken)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for wallet checkout, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Data domain.CheckoutSubscriptionResponse `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp.Data.Status != "PAID" || resp.Data.PaymentMethod != "WALLET" {
		t.Fatalf("expected PAID / WALLET in response, got %+v", resp.Data)
	}

	// 2. Verify wallet balance deducted: 200,000 - 111,000 (100k + 11k PPN) = 89,000 minor
	expectedBalance := int64(20000000 - (10000000 + 1100000))
	if saasRepo.wallet.BalanceMinor != expectedBalance {
		t.Fatalf("expected wallet balance %d, got %d", expectedBalance, saasRepo.wallet.BalanceMinor)
	}

	// 3. Verify policy updated to 5 automatically
	polAfter, err := policyEngine.GetEffectivePolicy(ctx, bizID)
	if err != nil || polAfter.NumericLimit["max_outlets"] != 5 {
		t.Fatalf("expected max_outlets 5 after wallet upgrade, got %v", polAfter)
	}
}

func TestFeature_SubscriptionCheckoutQRIS_AndWebhook(t *testing.T) {
	mux, tokenMaker, _, saasRepo, _, _, policyEngine := setupLandlordFeatureTest()

	ctx := context.Background()
	bizID := "b1"

	proPlan := &domain.Plan{
		ID:           "plan_pro",
		Code:         "PRO",
		Name:         "Pro Monthly",
		PriceMinor:   10000000,
		BillingCycle: "MONTHLY",
		Features: []domain.PlanFeature{
			{FeatureKey: "max_outlets", LimitValue: 10, IsEnabled: true},
		},
	}
	saasRepo.plans = map[string]*domain.Plan{
		"plan_pro": proPlan,
	}

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    bizID,
		Email: "merchant@godinov.com",
		Role:  "OWNER",
		Type:  "access",
	}, time.Hour)

	// Pre-condition: cache policy max_outlets = 1
	polBefore, err := policyEngine.GetEffectivePolicy(ctx, bizID)
	if err != nil || polBefore.NumericLimit["max_outlets"] != 1 {
		t.Fatalf("expected max_outlets 1 before checkout, got %v", polBefore)
	}

	// 1. Checkout via QRIS
	checkoutReq, _ := json.Marshal(domain.CheckoutSubscriptionRequest{
		PlanID:        "plan_pro",
		PaymentMethod: "QRIS",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/business/subscription/checkout", bytes.NewBuffer(checkoutReq))
	req.Header.Set("Authorization", "Bearer "+merchantToken)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for QRIS checkout, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Data domain.CheckoutSubscriptionResponse `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp.Data.Status != "PENDING" || resp.Data.PaymentMethod != "QRIS" {
		t.Fatalf("expected PENDING / QRIS in response, got %+v", resp.Data)
	}
	if resp.Data.GatewayReference == "" || resp.Data.PaymentURL == "" {
		t.Fatalf("expected gateway reference and payment url, got %+v", resp.Data)
	}

	// 2. Policy still unchanged before webhook
	polPending, _ := policyEngine.GetEffectivePolicy(ctx, bizID)
	if polPending.NumericLimit["max_outlets"] != 1 {
		t.Fatalf("expected max_outlets still 1 while pending, got %d", polPending.NumericLimit["max_outlets"])
	}

	// 3. Webhook received: payment.settled
	whPayload, _ := json.Marshal(domain.PaymentHubWebhookPayload{
		Event:       "payment.settled",
		ReferenceID: resp.Data.GatewayReference,
		AmountMinor: 11100000,
		BusinessID:  bizID,
	})
	whReq := httptest.NewRequest(http.MethodPost, "/v1/webhooks/payment-hub", bytes.NewBuffer(whPayload))
	whRR := httptest.NewRecorder()
	mux.ServeHTTP(whRR, whReq)

	if whRR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for payment webhook, got %d: %s", whRR.Code, whRR.Body.String())
	}

	// 4. Policy must now be upgraded to 10
	polUpgraded, err := policyEngine.GetEffectivePolicy(ctx, bizID)
	if err != nil || polUpgraded.NumericLimit["max_outlets"] != 10 {
		t.Fatalf("expected max_outlets 10 after webhook settled, got %v", polUpgraded)
	}

	// 5. Idempotent check: send same webhook again
	whReq2 := httptest.NewRequest(http.MethodPost, "/v1/webhooks/payment-hub", bytes.NewBuffer(whPayload))
	whRR2 := httptest.NewRecorder()
	mux.ServeHTTP(whRR2, whReq2)

	if whRR2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for duplicate webhook, got %d: %s", whRR2.Code, whRR2.Body.String())
	}
}

func TestFeature_LandlordLandingRevalidate(t *testing.T) {
	var revalidateHits int
	var receivedTag, receivedSecret string

	// 1. Mock Next.js revalidation server
	fakeNextServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		revalidateHits++
		receivedTag = r.URL.Query().Get("tag")
		receivedSecret = r.URL.Query().Get("secret")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"revalidated":true}`))
	}))
	defer fakeNextServer.Close()

	mux, tokenMaker, _, _, _, _, _ := setupLandlordFeatureTest(
		service.WithLandlordRevalidateConfig(fakeNextServer.URL, "secret-token-123"),
	)

	adminToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
		Role:  "SUPERADMIN",
	}, time.Hour)

	merchantToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "merchant@godinov.com",
		Type:  "access",
		Role:  "OWNER",
	}, time.Hour)

	// 2. Akses oleh Merchant -> 403 Forbidden
	reqForbidden := httptest.NewRequest(http.MethodPost, "/v1/landlord/landing/revalidate", nil)
	reqForbidden.Header.Set("Authorization", "Bearer "+merchantToken)
	rrForbidden := httptest.NewRecorder()
	mux.ServeHTTP(rrForbidden, reqForbidden)
	if rrForbidden.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when merchant triggers landlord revalidate, got %d", rrForbidden.Code)
	}

	// 3. Manual Force Revalidate oleh Superadmin -> 200 OK
	reqManual := httptest.NewRequest(http.MethodPost, "/v1/landlord/landing/revalidate", nil)
	reqManual.Header.Set("Authorization", "Bearer "+adminToken)
	rrManual := httptest.NewRecorder()
	mux.ServeHTTP(rrManual, reqManual)

	if rrManual.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for manual force revalidate, got %d: %s", rrManual.Code, rrManual.Body.String())
	}

	if revalidateHits != 1 {
		t.Fatalf("expected 1 hit on fake next server, got %d", revalidateHits)
	}
	if receivedTag != "landing-page" || receivedSecret != "secret-token-123" {
		t.Fatalf("unexpected query params: tag=%s, secret=%s", receivedTag, receivedSecret)
	}

	// 4. Update Landing Setting oleh Superadmin -> auto trigger revalidate asynchronous
	settingBody, _ := json.Marshal(map[string]any{
		"value":       domain.JSONB(`{"hero_title": "Platform POS Modern"}`),
		"description": "Judul hero baru",
	})
	reqSetting := httptest.NewRequest(http.MethodPut, "/v1/landlord/landing/settings/hero_title", bytes.NewBuffer(settingBody))
	reqSetting.Header.Set("Authorization", "Bearer "+adminToken)
	rrSetting := httptest.NewRecorder()
	mux.ServeHTTP(rrSetting, reqSetting)

	if rrSetting.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for update landing setting, got %d: %s", rrSetting.Code, rrSetting.Body.String())
	}

	// Wait up to 50ms for goroutine to hit revalidation server
	time.Sleep(50 * time.Millisecond)
	if revalidateHits < 2 {
		t.Fatalf("expected at least 2 hits on next server after updating setting, got %d", revalidateHits)
	}
}

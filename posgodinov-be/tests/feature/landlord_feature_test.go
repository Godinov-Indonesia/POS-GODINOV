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
}

func (m *mockFeatureSaaSRepo) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	return nil, nil
}

func (m *mockFeatureSaaSRepo) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) {
	return nil, nil
}

func (m *mockFeatureSaaSRepo) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) {
	if m.sub != nil && m.sub.Plan != nil && m.sub.Plan.ID == id {
		return m.sub.Plan, nil
	}
	return nil, nil
}

func (m *mockFeatureSaaSRepo) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error {
	return nil
}

func (m *mockFeatureSaaSRepo) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
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
	return nil
}

func (m *mockFeatureSaaSRepo) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	return nil, nil
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

func setupLandlordFeatureTest() (
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

	landlordSvc := service.NewLandlordService(landlordRepo, saasRepo, bizRepo, tokenMaker, policyEngine)
	landlordHandler := handler.NewLandlordHandler(landlordSvc)

	outletRepo := &MockFeatureOutletRepository{}
	txManager := database.NewMockTransactionManager()
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
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/suspend", landlordMw(landlordHandler.SuspendBusiness))
	mux.HandleFunc("POST /v1/landlord/businesses/{id}/unsuspend", landlordMw(landlordHandler.UnsuspendBusiness))

	mux.HandleFunc("POST /v1/business/outlets", merchantMw(outletHandler.Register))
	mux.HandleFunc("GET /v1/business/subscription", merchantMw(landlordHandler.GetTenantSubscription))
	mux.HandleFunc("POST /v1/business/staffs/{staff_id}/transfer", merchantMw(staffHandler.Transfer))

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

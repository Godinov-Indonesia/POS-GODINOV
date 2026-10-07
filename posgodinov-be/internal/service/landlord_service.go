package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/token"
)

type LandlordService interface {
	// Autentikasi Superadmin
	Login(ctx context.Context, req *domain.LandlordLoginRequest) (*domain.LandlordLoginResponse, error)
	GetMe(ctx context.Context, userID string) (*domain.LandlordUser, error)
	Impersonate(ctx context.Context, adminID, businessID string) (*domain.ImpersonateResponse, error)

	// Manajemen Fitur & Paket
	ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error)
	ListPlans(ctx context.Context) ([]domain.Plan, error)
	UpdatePlanFeature(ctx context.Context, adminID, planID, featureKey string, isEnabled bool, limitValue int64, extraConfig domain.JSONB) error

	// Tenant Overrides
	ListOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error)
	CreateOverride(ctx context.Context, adminID string, override *domain.TenantFeatureOverride) error
	DeleteOverride(ctx context.Context, adminID, overrideID, businessID string) error

	// Kampanye Iklan In-App
	ListCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error)
	CreateCampaign(ctx context.Context, adminID string, campaign *domain.SaaSCampaign) error

	// CMS Landing Page
	GetLandingSettings(ctx context.Context) ([]domain.LandingPageSetting, error)
	UpdateLandingSetting(ctx context.Context, adminID, key string, value domain.JSONB, desc string) error
	TriggerLandingRevalidate(ctx context.Context) error

	// Public Landing Page Aggregator
	GetPublicLandingPage(ctx context.Context) (map[string]any, error)

	// Merchant Subscription & Campaigns Self-Service
	GetTenantSubscription(ctx context.Context, businessID string) (map[string]any, error)
	CheckoutSubscription(ctx context.Context, businessID string, req *domain.CheckoutSubscriptionRequest) (*domain.CheckoutSubscriptionResponse, error)
	HandlePaymentWebhook(ctx context.Context, r *http.Request) error
	GetTenantCampaigns(ctx context.Context, businessID, placement string) ([]domain.SaaSCampaign, error)
	RecordCampaignClick(ctx context.Context, campaignID string) error

	// Manajemen Direktori Tenant & Suspensi
	ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*domain.BusinessWithSubscription, int64, error)
	GetBusinessDetail(ctx context.Context, businessID string) (*domain.BusinessDetailResponse, error)
	SuspendBusiness(ctx context.Context, adminID, businessID, reason string) error
	UnsuspendBusiness(ctx context.Context, adminID, businessID string) error
	GetMetricsOverview(ctx context.Context) (*domain.LandlordMetricsOverview, error)
}

type LandlordOption func(*landlordService)

func WithLandlordPaymentHub(client domain.PaymentHubClient) LandlordOption {
	return func(s *landlordService) {
		s.paymentHub = client
	}
}

func WithLandlordRevalidateConfig(url, secret string) LandlordOption {
	return func(s *landlordService) {
		s.revalidateURL = url
		s.revalidateSecret = secret
	}
}

func WithLandlordHTTPClient(client *http.Client) LandlordOption {
	return func(s *landlordService) {
		s.httpClient = client
	}
}

func WithLandlordTxManager(tm database.TransactionManager) LandlordOption {
	return func(s *landlordService) {
		s.txManager = tm
	}
}

type landlordService struct {
	landlordRepo     domain.LandlordRepository
	saasRepo         domain.SaaSRepository
	businessRepo     domain.BusinessRepository
	tokenMaker       token.TokenMaker
	policyEngine     domain.PolicyEngine
	paymentHub       domain.PaymentHubClient
	txManager        database.TransactionManager
	revalidateURL    string
	revalidateSecret string
	httpClient       *http.Client
}

func (s *landlordService) withTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if s.txManager != nil {
		return s.txManager.WithTransaction(ctx, fn)
	}
	return fn(ctx)
}

func NewLandlordService(
	landlordRepo domain.LandlordRepository,
	saasRepo domain.SaaSRepository,
	businessRepo domain.BusinessRepository,
	tokenMaker token.TokenMaker,
	policyEngine domain.PolicyEngine,
	opts ...LandlordOption,
) LandlordService {
	s := &landlordService{
		landlordRepo: landlordRepo,
		saasRepo:     saasRepo,
		businessRepo: businessRepo,
		tokenMaker:   tokenMaker,
		policyEngine: policyEngine,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *landlordService) Login(ctx context.Context, req *domain.LandlordLoginRequest) (*domain.LandlordLoginResponse, error) {
	user, err := s.landlordRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("email atau password salah")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("email atau password salah")
	}

	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    user.ID,
		Email: user.Email,
		Type:  "landlord",
		Role:  user.Role,
	}, 8*time.Hour)
	if err != nil {
		return nil, errors.New("gagal menerbitkan token landlord")
	}

	return &domain.LandlordLoginResponse{
		AccessToken: accessToken,
		User:        user,
	}, nil
}

func (s *landlordService) GetMe(ctx context.Context, userID string) (*domain.LandlordUser, error) {
	return s.landlordRepo.GetUserByID(ctx, userID)
}

func (s *landlordService) Impersonate(ctx context.Context, adminID, businessID string) (*domain.ImpersonateResponse, error) {
	admin, err := s.landlordRepo.GetUserByID(ctx, adminID)
	if err != nil {
		return nil, errors.New("admin tidak ditemukan")
	}

	business, err := s.businessRepo.GetByID(ctx, businessID)
	if err != nil {
		return nil, errors.New("bisnis tidak ditemukan")
	}

	// Terbitkan token bertenggat singkat (30 menit) dengan klaim impersonasi
	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:             business.ID,
		Email:          business.Email,
		Type:           "access",
		BusinessID:     business.ID,
		IsImpersonated: true,
		ImpersonatedBy: admin.ID,
	}, 30*time.Minute)
	if err != nil {
		return nil, errors.New("gagal menerbitkan token impersonasi")
	}

	// Catat di audit log secara permanen
	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     admin.ID,
		Action:     "IMPERSONATE",
		TargetType: "BUSINESS",
		TargetID:   business.ID,
		Metadata:   domain.JSONB(`{"business_name":"` + business.Name + `","admin_email":"` + admin.Email + `"}`),
	})

	return &domain.ImpersonateResponse{
		AccessToken: accessToken,
		ExpiresIn:   1800,
		Business:    business,
	}, nil
}

func (s *landlordService) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	return s.saasRepo.ListFeatures(ctx)
}

func (s *landlordService) ListPlans(ctx context.Context) ([]domain.Plan, error) {
	return s.saasRepo.ListPlans(ctx, false)
}

func (s *landlordService) UpdatePlanFeature(ctx context.Context, adminID, planID, featureKey string, isEnabled bool, limitValue int64, extraConfig domain.JSONB) error {
	pf := &domain.PlanFeature{
		PlanID:      planID,
		FeatureKey:  featureKey,
		IsEnabled:   isEnabled,
		LimitValue:  limitValue,
		ExtraConfig: extraConfig,
	}
	if err := s.saasRepo.UpdatePlanFeature(ctx, pf); err != nil {
		return err
	}

	// Broadcast invalidasi ke semua tenant plan ini
	if err := s.policyEngine.InvalidatePlan(ctx, planID); err != nil {
		s.policyEngine.InvalidateCache("")
	}

	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     adminID,
		Action:     "UPDATE_PLAN_FEATURE",
		TargetType: "PLAN",
		TargetID:   planID,
		Metadata:   domain.JSONB(`{"feature":"` + featureKey + `"}`),
	})

	return nil
}

func (s *landlordService) ListOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) {
	return s.saasRepo.ListActiveOverrides(ctx, businessID)
}

func (s *landlordService) CreateOverride(ctx context.Context, adminID string, override *domain.TenantFeatureOverride) error {
	override.CreatedBy = &adminID
	if err := s.saasRepo.CreateOverride(ctx, override); err != nil {
		return err
	}

	// Invalidasi cache tenant
	s.policyEngine.InvalidateCache(override.BusinessID)

	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     adminID,
		Action:     "CREATE_OVERRIDE",
		TargetType: "TENANT_OVERRIDE",
		TargetID:   override.BusinessID,
		Metadata:   domain.JSONB(`{"feature":"` + override.FeatureKey + `"}`),
	})

	return nil
}

func (s *landlordService) DeleteOverride(ctx context.Context, adminID, overrideID, businessID string) error {
	if err := s.saasRepo.DeleteOverride(ctx, overrideID); err != nil {
		return err
	}

	// Invalidasi cache tenant
	s.policyEngine.InvalidateCache(businessID)

	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     adminID,
		Action:     "DELETE_OVERRIDE",
		TargetType: "TENANT_OVERRIDE",
		TargetID:   overrideID,
	})

	return nil
}

func (s *landlordService) ListCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) {
	return s.saasRepo.ListActiveCampaigns(ctx, targetTier, placement)
}

func (s *landlordService) CreateCampaign(ctx context.Context, adminID string, campaign *domain.SaaSCampaign) error {
	if err := s.saasRepo.CreateCampaign(ctx, campaign); err != nil {
		return err
	}
	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     adminID,
		Action:     "CREATE_CAMPAIGN",
		TargetType: "CAMPAIGN",
		TargetID:   campaign.Title,
	})

	// Fire-and-forget revalidation
	go func() {
		revalCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.TriggerLandingRevalidate(revalCtx)
	}()

	return nil
}

func (s *landlordService) GetLandingSettings(ctx context.Context) ([]domain.LandingPageSetting, error) {
	return s.landlordRepo.GetLandingSettings(ctx)
}

func (s *landlordService) UpdateLandingSetting(ctx context.Context, adminID, key string, value domain.JSONB, desc string) error {
	setting := &domain.LandingPageSetting{
		Key:         key,
		Value:       value,
		Description: desc,
		UpdatedAt:   time.Now(),
		UpdatedBy:   &adminID,
	}
	if err := s.landlordRepo.UpsertLandingSetting(ctx, setting); err != nil {
		return err
	}
	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		UserID:     adminID,
		Action:     "UPDATE_LANDING_SETTING",
		TargetType: "LANDING_SETTING",
		TargetID:   key,
	})

	// Fire-and-forget revalidation
	go func() {
		revalCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.TriggerLandingRevalidate(revalCtx)
	}()

	return nil
}

func (s *landlordService) TriggerLandingRevalidate(ctx context.Context) error {
	if s.revalidateURL == "" {
		return nil
	}

	client := s.httpClient
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}

	reqURL := s.revalidateURL
	separator := "?"
	if strings.Contains(reqURL, "?") {
		separator = "&"
	}
	reqURL = fmt.Sprintf("%s%stag=landing-page&secret=%s", reqURL, separator, url.QueryEscape(s.revalidateSecret))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, nil)
	if err != nil {
		log.Printf("[revalidate] error creating request: %v", err)
		return err
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[revalidate] error triggering landing revalidate: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[revalidate] non-2xx status code: %d", resp.StatusCode)
		return fmt.Errorf("revalidate gagal dengan status %d", resp.StatusCode)
	}

	return nil
}

func (s *landlordService) GetPublicLandingPage(ctx context.Context) (map[string]any, error) {
	banners, _ := s.landlordRepo.GetActiveHeroBanners(ctx)
	faqs, _ := s.landlordRepo.GetActiveFAQs(ctx)
	announcements, _ := s.landlordRepo.GetActiveAnnouncements(ctx)
	plans, _ := s.saasRepo.ListPlans(ctx, true)
	settings, _ := s.landlordRepo.GetLandingSettings(ctx)

	settingsMap := make(map[string]any)
	for _, st := range settings {
		settingsMap[st.Key] = st.Value
	}

	return map[string]any{
		"hero_banners":  banners,
		"faqs":          faqs,
		"announcements": announcements,
		"plans":         plans,
		"settings":      settingsMap,
	}, nil
}

func (s *landlordService) GetTenantSubscription(ctx context.Context, businessID string) (map[string]any, error) {
	sub, err := s.saasRepo.GetSubscriptionByBusinessID(ctx, businessID)
	if err != nil {
		return nil, err
	}
	policy, err := s.policyEngine.GetEffectivePolicy(ctx, businessID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"subscription": sub,
		"policy":       policy,
	}, nil
}

func (s *landlordService) CheckoutSubscription(ctx context.Context, businessID string, req *domain.CheckoutSubscriptionRequest) (*domain.CheckoutSubscriptionResponse, error) {
	if req.PlanID == "" {
		return nil, errors.New("plan_id tidak boleh kosong")
	}

	plan, err := s.saasRepo.GetPlanByID(ctx, req.PlanID)
	if err != nil || plan == nil {
		return nil, errors.New("paket langganan tidak ditemukan")
	}

	sub, err := s.saasRepo.GetSubscriptionByBusinessID(ctx, businessID)
	if err != nil || sub == nil {
		return nil, errors.New("langganan bisnis tidak ditemukan")
	}

	amount := plan.PriceMinor
	tax := int64(float64(amount) * 0.11)
	total := amount + tax
	now := time.Now()
	invNum := fmt.Sprintf("INV-%s-%d", now.Format("20060102"), now.UnixNano()%100000)

	// 1. Bayar via Wallet balance
	if req.PaymentMethod == "WALLET" {
		var oldPlanID string
		err := s.withTx(ctx, func(txCtx context.Context) error {
			wallet, err := s.saasRepo.GetWalletByBusinessID(txCtx, businessID)
			if err != nil || wallet == nil {
				return errors.New("dompet merchant tidak ditemukan")
			}
			if wallet.BalanceMinor < total {
				return errors.New("saldo dompet tidak mencukupi untuk upgrade")
			}

			currentSub, err := s.saasRepo.GetSubscriptionByBusinessID(txCtx, businessID)
			if err != nil || currentSub == nil {
				return errors.New("langganan bisnis tidak ditemukan")
			}

			wallet.BalanceMinor -= total
			wallet.UpdatedAt = now
			if err := s.saasRepo.UpdateWallet(txCtx, wallet); err != nil {
				return fmt.Errorf("gagal memotong saldo dompet: %w", err)
			}

			oldPlanID = currentSub.PlanID
			currentSub.PlanID = plan.ID
			currentSub.Status = "ACTIVE"
			currentSub.UpdatedAt = now
			var expiresAt time.Time
			if plan.BillingCycle == "YEARLY" {
				expiresAt = now.AddDate(1, 0, 0)
			} else {
				expiresAt = now.AddDate(0, 1, 0)
			}
			currentSub.ExpiresAt = &expiresAt
			if err := s.saasRepo.UpdateSubscription(txCtx, currentSub); err != nil {
				return fmt.Errorf("gagal mengupdate langganan: %w", err)
			}

			inv := &domain.SubscriptionInvoice{
				ID:               uuid.New().String(),
				BusinessID:       businessID,
				SubscriptionID:   currentSub.ID,
				InvoiceNumber:    invNum,
				PlanID:           plan.ID,
				BillingCycle:     plan.BillingCycle,
				AmountMinor:      amount,
				TaxMinor:         tax,
				TotalMinor:       total,
				Status:           "PAID",
				PaymentGateway:   "WALLET",
				GatewayReference: invNum,
				PaymentMethod:    "WALLET",
				PaidAt:           &now,
				ExpiredAt:        now,
				CreatedAt:        now,
			}
			if err := s.saasRepo.CreateInvoice(txCtx, inv); err != nil {
				return fmt.Errorf("gagal membuat invoice: %w", err)
			}

			if err := s.saasRepo.CreateSubscriptionLog(txCtx, &domain.SubscriptionLog{
				ID:             uuid.New().String(),
				SubscriptionID: currentSub.ID,
				BusinessID:     businessID,
				Event:          "CHECKOUT_WALLET",
				FromPlanID:     &oldPlanID,
				ToPlanID:       plan.ID,
				Remarks:        fmt.Sprintf("Upgrade ke %s via Saldo Wallet", plan.Name),
				CreatedAt:      now,
			}); err != nil {
				return fmt.Errorf("gagal mencatat log langganan: %w", err)
			}

			return nil
		})
		if err != nil {
			return nil, err
		}

		s.policyEngine.InvalidateCache(businessID)

		return &domain.CheckoutSubscriptionResponse{
			PaymentMethod: "WALLET",
			Status:        "PAID",
			InvoiceNumber: invNum,
		}, nil
	}

	// 2. Bayar via Gateway (QRIS / VA / dll)
	if s.paymentHub == nil {
		return nil, errors.New("payment hub gateway belum terkonfigurasi")
	}

	checkoutResp, err := s.paymentHub.CreateSubscriptionInvoice(ctx, &domain.SubscriptionInvoiceRequest{
		InvoiceNumber: invNum,
		BusinessID:    businessID,
		PlanName:      plan.Name,
		AmountMinor:   amount,
		TaxMinor:      tax,
		TotalMinor:    total,
	})
	if err != nil {
		return nil, fmt.Errorf("gagal membuat invoice pembayaran: %w", err)
	}

	expiredAt := now.Add(24 * time.Hour)
	inv := &domain.SubscriptionInvoice{
		ID:               uuid.New().String(),
		BusinessID:       businessID,
		SubscriptionID:   sub.ID,
		InvoiceNumber:    invNum,
		PlanID:           plan.ID,
		BillingCycle:     plan.BillingCycle,
		AmountMinor:      amount,
		TaxMinor:         tax,
		TotalMinor:       total,
		Status:           "PENDING",
		PaymentGateway:   "GODINOV_PAYMENT_HUB",
		GatewayReference: checkoutResp.GatewayReference,
		PaymentMethod:    req.PaymentMethod,
		PaymentURL:       checkoutResp.PaymentURL,
		VANumber:         checkoutResp.VANumber,
		QRPayload:        checkoutResp.QRPayload,
		ExpiredAt:        expiredAt,
		CreatedAt:        now,
	}

	err = s.withTx(ctx, func(txCtx context.Context) error {
		if err := s.saasRepo.CreateInvoice(txCtx, inv); err != nil {
			return fmt.Errorf("gagal menyimpan invoice: %w", err)
		}

		return s.saasRepo.CreateSubscriptionLog(txCtx, &domain.SubscriptionLog{
			ID:             uuid.New().String(),
			SubscriptionID: sub.ID,
			BusinessID:     businessID,
			Event:          "CHECKOUT_INITIATED",
			FromPlanID:     &sub.PlanID,
			ToPlanID:       plan.ID,
			Remarks:        fmt.Sprintf("Checkout initiated with method %s", req.PaymentMethod),
			CreatedAt:      now,
		})
	})
	if err != nil {
		return nil, err
	}

	return &domain.CheckoutSubscriptionResponse{
		PaymentMethod:    req.PaymentMethod,
		Status:           "PENDING",
		InvoiceNumber:    invNum,
		GatewayReference: checkoutResp.GatewayReference,
		PaymentURL:       checkoutResp.PaymentURL,
		QRPayload:        checkoutResp.QRPayload,
		VANumber:         checkoutResp.VANumber,
	}, nil
}

func (s *landlordService) HandlePaymentWebhook(ctx context.Context, r *http.Request) error {
	if s.paymentHub == nil {
		return errors.New("payment hub belum terkonfigurasi")
	}

	payload, err := s.paymentHub.VerifyWebhookSignature(r)
	if err != nil {
		return fmt.Errorf("verifikasi webhook gagal: %w", err)
	}

	now := time.Now()
	var invalidatedBusinessID string

	err = s.withTx(ctx, func(txCtx context.Context) error {
		inv, err := s.saasRepo.GetInvoiceByReference(txCtx, payload.ReferenceID)
		if err != nil || inv == nil {
			return errors.New("invoice pembayaran tidak ditemukan")
		}

		// Idempotency check: jika sudah PAID, jangan proses ulang
		if inv.Status == "PAID" {
			return nil
		}

		if payload.Event == "payment.settled" {
			if err := s.saasRepo.UpdateInvoiceStatus(txCtx, inv.ID, "PAID", &now); err != nil {
				return err
			}

			sub, err := s.saasRepo.GetSubscriptionByBusinessID(txCtx, inv.BusinessID)
			if err != nil || sub == nil {
				return fmt.Errorf("langganan untuk bisnis %s tidak ditemukan", inv.BusinessID)
			}

			oldPlanID := sub.PlanID
			sub.PlanID = inv.PlanID
			sub.Status = "ACTIVE"
			sub.UpdatedAt = now
			var expiresAt time.Time
			if inv.BillingCycle == "YEARLY" {
				expiresAt = now.AddDate(1, 0, 0)
			} else {
				expiresAt = now.AddDate(0, 1, 0)
			}
			sub.ExpiresAt = &expiresAt
			if err := s.saasRepo.UpdateSubscription(txCtx, sub); err != nil {
				return err
			}

			if err := s.saasRepo.CreateSubscriptionLog(txCtx, &domain.SubscriptionLog{
				ID:             uuid.New().String(),
				SubscriptionID: sub.ID,
				BusinessID:     inv.BusinessID,
				Event:          "UPGRADED",
				FromPlanID:     &oldPlanID,
				ToPlanID:       inv.PlanID,
				Remarks:        fmt.Sprintf("Upgrade via payment webhook invoice %s", inv.InvoiceNumber),
				CreatedAt:      now,
			}); err != nil {
				return err
			}

			invalidatedBusinessID = inv.BusinessID
		} else if payload.Event == "payment.expired" {
			if err := s.saasRepo.UpdateInvoiceStatus(txCtx, inv.ID, "EXPIRED", nil); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	if invalidatedBusinessID != "" {
		s.policyEngine.InvalidateCache(invalidatedBusinessID)
	}

	return nil
}

func (s *landlordService) GetTenantCampaigns(ctx context.Context, businessID, placement string) ([]domain.SaaSCampaign, error) {
	policy, err := s.policyEngine.GetEffectivePolicy(ctx, businessID)
	if err != nil {
		return nil, err
	}

	// Jika plan adalah Pro atau memiliki flag no_ads == true, jangan tampilkan iklan
	if policy.BooleanFlags["no_ads"] || policy.PlanCode == "PRO" || policy.PlanCode == "ENTERPRISE" {
		return []domain.SaaSCampaign{}, nil
	}

	return s.saasRepo.ListActiveCampaigns(ctx, "FREE_ONLY", placement)
}

func (s *landlordService) RecordCampaignClick(ctx context.Context, campaignID string) error {
	return s.saasRepo.IncrementCampaignClick(ctx, campaignID)
}

func (s *landlordService) ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*domain.BusinessWithSubscription, int64, error) {
	return s.landlordRepo.ListBusinesses(ctx, search, status, planID, page, limit)
}

func (s *landlordService) GetBusinessDetail(ctx context.Context, businessID string) (*domain.BusinessDetailResponse, error) {
	biz, sub, wallet, overrides, err := s.landlordRepo.GetBusinessDetail(ctx, businessID)
	if err != nil {
		return nil, err
	}

	policy, _ := s.policyEngine.GetEffectivePolicy(ctx, businessID)

	return &domain.BusinessDetailResponse{
		Business:     biz,
		Subscription: sub,
		Wallet:       wallet,
		Overrides:    overrides,
		Policy:       policy,
	}, nil
}

func (s *landlordService) SuspendBusiness(ctx context.Context, adminID, businessID, reason string) error {
	if _, err := s.businessRepo.GetByID(ctx, businessID); err != nil {
		return errors.New("bisnis tidak ditemukan")
	}

	if err := s.landlordRepo.SetBusinessSubscriptionStatus(ctx, businessID, "SUSPENDED"); err != nil {
		return err
	}

	s.policyEngine.InvalidateCache(businessID)

	meta, _ := json.Marshal(map[string]string{"reason": reason})
	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		ID:         uuid.New().String(),
		UserID:     adminID,
		Action:     "SUSPEND_BUSINESS",
		TargetType: "BUSINESS",
		TargetID:   businessID,
		Metadata:   domain.JSONB(meta),
		CreatedAt:  time.Now(),
	})

	return nil
}

func (s *landlordService) UnsuspendBusiness(ctx context.Context, adminID, businessID string) error {
	if _, err := s.businessRepo.GetByID(ctx, businessID); err != nil {
		return errors.New("bisnis tidak ditemukan")
	}

	if err := s.landlordRepo.SetBusinessSubscriptionStatus(ctx, businessID, "ACTIVE"); err != nil {
		return err
	}

	s.policyEngine.InvalidateCache(businessID)

	meta, _ := json.Marshal(map[string]string{"action": "unsuspend"})
	_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
		ID:         uuid.New().String(),
		UserID:     adminID,
		Action:     "UNSUSPEND_BUSINESS",
		TargetType: "BUSINESS",
		TargetID:   businessID,
		Metadata:   domain.JSONB(meta),
		CreatedAt:  time.Now(),
	})

	return nil
}

func (s *landlordService) GetMetricsOverview(ctx context.Context) (*domain.LandlordMetricsOverview, error) {
	return s.landlordRepo.GetMetricsOverview(ctx)
}

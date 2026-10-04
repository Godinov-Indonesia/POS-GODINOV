package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

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

	// Public Landing Page Aggregator
	GetPublicLandingPage(ctx context.Context) (map[string]any, error)

	// Merchant Subscription & Campaigns Self-Service
	GetTenantSubscription(ctx context.Context, businessID string) (map[string]any, error)
	GetTenantCampaigns(ctx context.Context, businessID, placement string) ([]domain.SaaSCampaign, error)
	RecordCampaignClick(ctx context.Context, campaignID string) error

	// Manajemen Direktori Tenant & Suspensi
	ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*domain.BusinessWithSubscription, int64, error)
	GetBusinessDetail(ctx context.Context, businessID string) (*domain.BusinessDetailResponse, error)
	SuspendBusiness(ctx context.Context, adminID, businessID, reason string) error
	UnsuspendBusiness(ctx context.Context, adminID, businessID string) error
	GetMetricsOverview(ctx context.Context) (*domain.LandlordMetricsOverview, error)
}

type landlordService struct {
	landlordRepo domain.LandlordRepository
	saasRepo     domain.SaaSRepository
	businessRepo domain.BusinessRepository
	tokenMaker   token.TokenMaker
	policyEngine domain.PolicyEngine
}

func NewLandlordService(
	landlordRepo domain.LandlordRepository,
	saasRepo domain.SaaSRepository,
	businessRepo domain.BusinessRepository,
	tokenMaker token.TokenMaker,
	policyEngine domain.PolicyEngine,
) LandlordService {
	return &landlordService{
		landlordRepo: landlordRepo,
		saasRepo:     saasRepo,
		businessRepo: businessRepo,
		tokenMaker:   tokenMaker,
		policyEngine: policyEngine,
	}
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

	// Invalidasi cache global saat plan feature berubah
	s.policyEngine.InvalidateCache("")

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

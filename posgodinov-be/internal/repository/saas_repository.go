package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresSaaSRepository struct {
	db *gorm.DB
}

func NewSaaSRepository(db *gorm.DB) domain.SaaSRepository {
	return &postgresSaaSRepository{db: db}
}

func (r *postgresSaaSRepository) ListFeatures(ctx context.Context) ([]domain.SaaSFeature, error) {
	db := database.GetDB(ctx, r.db)
	var features []domain.SaaSFeature
	err := db.WithContext(ctx).Where("is_active = ?", true).Order("sort_order ASC").Find(&features).Error
	return features, err
}

func (r *postgresSaaSRepository) ListPlans(ctx context.Context, publicOnly bool) ([]domain.Plan, error) {
	db := database.GetDB(ctx, r.db)
	query := db.WithContext(ctx).Preload("Features.Feature").Where("is_active = ?", true)
	if publicOnly {
		query = query.Where("is_public = ?", true)
	}
	var plans []domain.Plan
	err := query.Order("sort_order ASC").Find(&plans).Error
	return plans, err
}

func (r *postgresSaaSRepository) GetPlanByID(ctx context.Context, id string) (*domain.Plan, error) {
	db := database.GetDB(ctx, r.db)
	var plan domain.Plan
	if err := db.WithContext(ctx).Preload("Features.Feature").Where("id = ?", id).First(&plan).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket tidak ditemukan")
		}
		return nil, err
	}
	return &plan, nil
}

func (r *postgresSaaSRepository) UpdatePlanFeature(ctx context.Context, pf *domain.PlanFeature) error {
	db := database.GetDB(ctx, r.db)
	pf.UpdatedAt = time.Now()
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "plan_id"}, {Name: "feature_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"is_enabled", "limit_value", "extra_config", "updated_at"}),
	}).Create(pf).Error
}

func (r *postgresSaaSRepository) GetSubscriptionByBusinessID(ctx context.Context, businessID string) (*domain.Subscription, error) {
	db := database.GetDB(ctx, r.db)
	var sub domain.Subscription
	if err := db.WithContext(ctx).Preload("Plan.Features.Feature").Where("business_id = ?", businessID).First(&sub).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("langganan bisnis tidak ditemukan")
		}
		return nil, err
	}
	return &sub, nil
}

func (r *postgresSaaSRepository) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(sub).Error
}

func (r *postgresSaaSRepository) UpdateSubscription(ctx context.Context, sub *domain.Subscription) error {
	db := database.GetDB(ctx, r.db)
	sub.UpdatedAt = time.Now()
	return db.WithContext(ctx).Save(sub).Error
}

func (r *postgresSaaSRepository) CreateSubscriptionLog(ctx context.Context, log *domain.SubscriptionLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(log).Error
}

func (r *postgresSaaSRepository) ListActiveOverrides(ctx context.Context, businessID string) ([]domain.TenantFeatureOverride, error) {
	db := database.GetDB(ctx, r.db)
	now := time.Now()
	var overrides []domain.TenantFeatureOverride
	err := db.WithContext(ctx).
		Where("business_id = ? AND (expires_at IS NULL OR expires_at >= ?)", businessID, now).
		Find(&overrides).Error
	return overrides, err
}

func (r *postgresSaaSRepository) CreateOverride(ctx context.Context, override *domain.TenantFeatureOverride) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(override).Error
}

func (r *postgresSaaSRepository) DeleteOverride(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Where("id = ?", id).Delete(&domain.TenantFeatureOverride{}).Error
}

func (r *postgresSaaSRepository) CreateWallet(ctx context.Context, wallet *domain.MerchantWallet) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(wallet).Error
}

func (r *postgresSaaSRepository) GetWalletByBusinessID(ctx context.Context, businessID string) (*domain.MerchantWallet, error) {
	db := database.GetDB(ctx, r.db)
	var wallet domain.MerchantWallet
	if err := db.WithContext(ctx).Where("business_id = ?", businessID).First(&wallet).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("dompet merchant tidak ditemukan")
		}
		return nil, err
	}
	return &wallet, nil
}

func (r *postgresSaaSRepository) ListActiveCampaigns(ctx context.Context, targetTier, placement string) ([]domain.SaaSCampaign, error) {
	db := database.GetDB(ctx, r.db)
	now := time.Now()
	query := db.WithContext(ctx).
		Where("is_active = ? AND starts_at <= ? AND (ends_at IS NULL OR ends_at >= ?)", true, now, now)

	if targetTier != "" {
		query = query.Where("(target_tier = ? OR target_tier = 'ALL')", targetTier)
	}
	if placement != "" {
		query = query.Where("placement = ?", placement)
	}

	var campaigns []domain.SaaSCampaign
	err := query.Order("priority DESC, created_at DESC").Find(&campaigns).Error
	return campaigns, err
}

func (r *postgresSaaSRepository) GetCampaignByID(ctx context.Context, id string) (*domain.SaaSCampaign, error) {
	db := database.GetDB(ctx, r.db)
	var campaign domain.SaaSCampaign
	if err := db.WithContext(ctx).Where("id = ?", id).First(&campaign).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kampanye tidak ditemukan")
		}
		return nil, err
	}
	return &campaign, nil
}

func (r *postgresSaaSRepository) IncrementCampaignClick(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.SaaSCampaign{}).Where("id = ?", id).
		UpdateColumn("click_count", gorm.Expr("click_count + 1")).Error
}

func (r *postgresSaaSRepository) CreateCampaign(ctx context.Context, campaign *domain.SaaSCampaign) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(campaign).Error
}

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

type postgresLandlordRepository struct {
	db *gorm.DB
}

func NewLandlordRepository(db *gorm.DB) domain.LandlordRepository {
	return &postgresLandlordRepository{db: db}
}

func (r *postgresLandlordRepository) GetUserByEmail(ctx context.Context, email string) (*domain.LandlordUser, error) {
	db := database.GetDB(ctx, r.db)
	var user domain.LandlordUser
	if err := db.WithContext(ctx).Where("email = ? AND is_active = ?", email, true).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pengguna landlord tidak ditemukan")
		}
		return nil, err
	}
	return &user, nil
}

func (r *postgresLandlordRepository) GetUserByID(ctx context.Context, id string) (*domain.LandlordUser, error) {
	db := database.GetDB(ctx, r.db)
	var user domain.LandlordUser
	if err := db.WithContext(ctx).Where("id = ? AND is_active = ?", id, true).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pengguna landlord tidak ditemukan")
		}
		return nil, err
	}
	return &user, nil
}

func (r *postgresLandlordRepository) CreateAuditLog(ctx context.Context, log *domain.LandlordAuditLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(log).Error
}

func (r *postgresLandlordRepository) GetLandingSettings(ctx context.Context) ([]domain.LandingPageSetting, error) {
	db := database.GetDB(ctx, r.db)
	var settings []domain.LandingPageSetting
	if err := db.WithContext(ctx).Find(&settings).Error; err != nil {
		return nil, err
	}
	return settings, nil
}

func (r *postgresLandlordRepository) GetLandingSettingByKey(ctx context.Context, key string) (*domain.LandingPageSetting, error) {
	db := database.GetDB(ctx, r.db)
	var setting domain.LandingPageSetting
	if err := db.WithContext(ctx).Where("key = ?", key).First(&setting).Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *postgresLandlordRepository) UpsertLandingSetting(ctx context.Context, setting *domain.LandingPageSetting) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "description", "updated_at", "updated_by"}),
	}).Create(setting).Error
}

func (r *postgresLandlordRepository) GetActiveHeroBanners(ctx context.Context) ([]domain.LandingHeroBanner, error) {
	db := database.GetDB(ctx, r.db)
	var banners []domain.LandingHeroBanner
	now := time.Now()
	err := db.WithContext(ctx).
		Where("is_active = ? AND starts_at <= ? AND (ends_at IS NULL OR ends_at >= ?)", true, now, now).
		Order("sort_order ASC, created_at DESC").
		Find(&banners).Error
	return banners, err
}

func (r *postgresLandlordRepository) GetActiveFAQs(ctx context.Context) ([]domain.LandingFAQ, error) {
	db := database.GetDB(ctx, r.db)
	var faqs []domain.LandingFAQ
	err := db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("sort_order ASC, created_at ASC").
		Find(&faqs).Error
	return faqs, err
}

func (r *postgresLandlordRepository) GetActiveAnnouncements(ctx context.Context) ([]domain.SystemAnnouncement, error) {
	db := database.GetDB(ctx, r.db)
	var announcements []domain.SystemAnnouncement
	now := time.Now()
	err := db.WithContext(ctx).
		Where("is_active = ? AND starts_at <= ? AND ends_at >= ?", true, now, now).
		Order("created_at DESC").
		Find(&announcements).Error
	return announcements, err
}

func (r *postgresLandlordRepository) ListBusinesses(ctx context.Context, search, status, planID string, page, limit int) ([]*domain.BusinessWithSubscription, int64, error) {
	db := database.GetDB(ctx, r.db)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := db.WithContext(ctx).Table("businesses b").
		Select(`b.id, b.serial_business, b.email, b.name, b.owner_name, b.created_at, 
			COALESCE(s.plan_id, '') as plan_id, 
			COALESCE(p.code, 'FREE') as plan_code, 
			COALESCE(p.name, 'Free Tier') as plan_name, 
			COALESCE(s.status, 'ACTIVE') as sub_status, 
			s.expires_at`).
		Joins("LEFT JOIN subscriptions s ON b.id = s.business_id").
		Joins("LEFT JOIN plans p ON s.plan_id = p.id").
		Where("b.is_deleted = ?", false)

	if search != "" {
		likeTerm := "%" + search + "%"
		query = query.Where("(b.name ILIKE ? OR b.email ILIKE ? OR b.owner_name ILIKE ?)", likeTerm, likeTerm, likeTerm)
	}
	if status != "" {
		query = query.Where("s.status = ?", status)
	}
	if planID != "" {
		query = query.Where("s.plan_id = ?", planID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var results []*domain.BusinessWithSubscription
	if err := query.Order("b.created_at DESC").Limit(limit).Offset(offset).Scan(&results).Error; err != nil {
		return nil, 0, err
	}

	return results, total, nil
}

func (r *postgresLandlordRepository) GetBusinessDetail(ctx context.Context, businessID string) (*domain.Business, *domain.Subscription, *domain.MerchantWallet, []domain.TenantFeatureOverride, error) {
	db := database.GetDB(ctx, r.db)

	var business domain.Business
	if err := db.WithContext(ctx).Where("id = ? AND is_deleted = ?", businessID, false).First(&business).Error; err != nil {
		return nil, nil, nil, nil, err
	}

	var subscription domain.Subscription
	_ = db.WithContext(ctx).Preload("Plan.Features").Where("business_id = ?", businessID).First(&subscription).Error

	var wallet domain.MerchantWallet
	_ = db.WithContext(ctx).Where("business_id = ?", businessID).First(&wallet).Error

	var overrides []domain.TenantFeatureOverride
	now := time.Now()
	_ = db.WithContext(ctx).Where("business_id = ? AND (expires_at IS NULL OR expires_at > ?)", businessID, now).Find(&overrides).Error

	return &business, &subscription, &wallet, overrides, nil
}

func (r *postgresLandlordRepository) SetBusinessSubscriptionStatus(ctx context.Context, businessID string, status string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.Subscription{}).
		Where("business_id = ?", businessID).
		Update("status", status).Error
}

func (r *postgresLandlordRepository) GetMetricsOverview(ctx context.Context) (*domain.LandlordMetricsOverview, error) {
	db := database.GetDB(ctx, r.db)
	overview := &domain.LandlordMetricsOverview{
		BusinessesByPlan: make(map[string]int64),
	}

	_ = db.WithContext(ctx).Model(&domain.Business{}).Where("is_deleted = ?", false).Count(&overview.TotalBusinesses).Error
	_ = db.WithContext(ctx).Model(&domain.Subscription{}).Where("status = ?", "ACTIVE").Count(&overview.ActiveBusinesses).Error
	_ = db.WithContext(ctx).Model(&domain.Subscription{}).Where("status = ?", "SUSPENDED").Count(&overview.SuspendedBusinesses).Error

	type PlanCount struct {
		Code  string
		Total int64
	}
	var planCounts []PlanCount
	_ = db.WithContext(ctx).Table("subscriptions s").
		Select("p.code as code, count(*) as total").
		Joins("JOIN plans p ON s.plan_id = p.id").
		Group("p.code").
		Scan(&planCounts).Error

	for _, pc := range planCounts {
		overview.BusinessesByPlan[pc.Code] = pc.Total
	}

	var mrr *int64
	_ = db.WithContext(ctx).Table("subscriptions s").
		Select("COALESCE(SUM(p.price_minor), 0)").
		Joins("JOIN plans p ON s.plan_id = p.id").
		Where("s.status = ?", "ACTIVE").
		Scan(&mrr).Error
	if mrr != nil {
		overview.EstimatedMRRMinor = *mrr
	}

	return overview, nil
}

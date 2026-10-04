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

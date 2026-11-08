package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

type postgresPOSMobileCredentialRepository struct {
	db *gorm.DB
}

func NewPOSMobileCredentialRepository(db *gorm.DB) domain.POSMobileCredentialRepository {
	return &postgresPOSMobileCredentialRepository{db: db}
}

func (r *postgresPOSMobileCredentialRepository) Create(ctx context.Context, cred *domain.POSMobileCredential) error {
	if cred.ID == "" {
		cred.ID = utils.NewUUID()
	}
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(cred).Error
}

func (r *postgresPOSMobileCredentialRepository) GetByID(ctx context.Context, id string) (*domain.POSMobileCredential, error) {
	db := database.GetDB(ctx, r.db)
	var cred domain.POSMobileCredential
	if err := db.WithContext(ctx).Where("id = ?", id).First(&cred).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kredensial pos mobile tidak ditemukan")
		}
		return nil, err
	}
	return &cred, nil
}

func (r *postgresPOSMobileCredentialRepository) GetByCode(ctx context.Context, code string) (*domain.POSMobileCredential, error) {
	db := database.GetDB(ctx, r.db)
	var cred domain.POSMobileCredential
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	if err := db.WithContext(ctx).Where("UPPER(code) = ?", cleanCode).First(&cred).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kredensial pos mobile tidak ditemukan")
		}
		return nil, err
	}
	return &cred, nil
}

func (r *postgresPOSMobileCredentialRepository) List(ctx context.Context, search string, isActive *bool, page, limit int) ([]domain.POSMobileCredential, int64, error) {
	db := database.GetDB(ctx, r.db)
	query := db.WithContext(ctx).Model(&domain.POSMobileCredential{})

	if s := strings.TrimSpace(search); s != "" {
		pattern := "%" + strings.ToLower(s) + "%"
		query = query.Where("LOWER(label) LIKE ? OR LOWER(code) LIKE ? OR LOWER(notes) LIKE ?", pattern, pattern, pattern)
	}

	if isActive != nil {
		query = query.Where("is_active = ?", *isActive)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var list []domain.POSMobileCredential
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *postgresPOSMobileCredentialRepository) Update(ctx context.Context, cred *domain.POSMobileCredential) error {
	db := database.GetDB(ctx, r.db)
	cred.UpdatedAt = time.Now()
	return db.WithContext(ctx).Save(cred).Error
}

func (r *postgresPOSMobileCredentialRepository) Delete(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Where("id = ?", id).Delete(&domain.POSMobileCredential{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("kredensial pos mobile tidak ditemukan")
	}
	return nil
}

func (r *postgresPOSMobileCredentialRepository) IncrementUsage(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	now := time.Now()
	return db.WithContext(ctx).Model(&domain.POSMobileCredential{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"usage_count":  gorm.Expr("usage_count + ?", 1),
			"last_used_at": now,
			"updated_at":   now,
		}).Error
}

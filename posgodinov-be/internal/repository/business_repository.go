package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/database"
)

type postgresBusinessRepository struct {
	db *gorm.DB
}

func NewBusinessRepository(db *gorm.DB) domain.BusinessRepository {
	return &postgresBusinessRepository{db: db}
}

func (r *postgresBusinessRepository) Create(ctx context.Context, business *domain.Business) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(business).Error
}

func (r *postgresBusinessRepository) GetByEmail(ctx context.Context, email string) (*domain.Business, error) {
	db := database.GetDB(ctx, r.db)
	var b domain.Business
	if err := db.WithContext(ctx).Where("email = ? AND is_deleted = ?", email, false).First(&b).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("business not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *postgresBusinessRepository) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	db := database.GetDB(ctx, r.db)
	var b domain.Business
	if err := db.WithContext(ctx).Where("serial_business = ? AND is_deleted = ?", serial, false).First(&b).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("business not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *postgresBusinessRepository) GetByID(ctx context.Context, id string) (*domain.Business, error) {
	db := database.GetDB(ctx, r.db)
	var b domain.Business
	if err := db.WithContext(ctx).Where("id = ? AND is_deleted = ?", id, false).First(&b).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("business not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *postgresBusinessRepository) LockByID(ctx context.Context, id string) (*domain.Business, error) {
	db := database.GetDB(ctx, r.db)
	var b domain.Business
	// FOR UPDATE untuk menghindari race condition
	if err := db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&b).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("business not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *postgresBusinessRepository) GetByGoogleID(ctx context.Context, googleID string) (*domain.Business, error) {
	db := database.GetDB(ctx, r.db)
	var b domain.Business
	if err := db.WithContext(ctx).Where("google_id = ? AND is_deleted = ?", googleID, false).First(&b).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("business not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *postgresBusinessRepository) UpsertByGoogle(ctx context.Context, b *domain.Business) error {
	db := database.GetDB(ctx, r.db)
	// ON CONFLICT (email): link google_id ke akun yang sudah ada, atau insert baru.
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "email"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"google_id": b.GoogleID}),
	}).Create(b).Error
}

package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type postgresStaffRepository struct {
	db *gorm.DB
}

func NewStaffRepository(db *gorm.DB) domain.StaffRepository {
	return &postgresStaffRepository{db: db}
}

func (r *postgresStaffRepository) Create(ctx context.Context, staff *domain.Staff) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Create(staff).Error
}

func (r *postgresStaffRepository) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) {
	db := database.GetDB(ctx, r.db)
	var staff domain.Staff
	if err := db.WithContext(ctx).Where("outlet_id = ? AND staff_identifier = ? AND is_deleted = ?", outletID, staffIdentifier, false).First(&staff).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("staff tidak ditemukan")
		}
		return nil, err
	}
	return &staff, nil
}

func (r *postgresStaffRepository) GetByID(ctx context.Context, id string) (*domain.Staff, error) {
	db := database.GetDB(ctx, r.db)
	var staff domain.Staff
	if err := db.WithContext(ctx).Where("id = ? AND is_deleted = ?", id, false).First(&staff).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("staff tidak ditemukan")
		}
		return nil, err
	}
	return &staff, nil
}

func (r *postgresStaffRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	db := database.GetDB(ctx, r.db)
	var staffs []*domain.Staff
	err := db.WithContext(ctx).Where("outlet_id = ? AND is_deleted = ?", outletID, false).Order("created_at desc").Find(&staffs).Error
	return staffs, err
}

func (r *postgresStaffRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	db := database.GetDB(ctx, r.db)
	var staffs []*domain.Staff
	// Join with outlets table to filter by business_id
	err := db.WithContext(ctx).
		Joins("JOIN outlets ON outlets.id = users.outlet_id").
		Where("outlets.business_id = ? AND users.is_deleted = ?", businessID, false).
		Order("users.created_at desc").
		Find(&staffs).Error
	return staffs, err
}

func (r *postgresStaffRepository) Update(ctx context.Context, staff *domain.Staff) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Save(staff).Error
}

func (r *postgresStaffRepository) Delete(ctx context.Context, id string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.Staff{}).Where("id = ?", id).Update("is_deleted", true).Error
}

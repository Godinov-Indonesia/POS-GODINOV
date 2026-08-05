package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type posRepository struct {
	db *gorm.DB
}

func NewPOSRepository(db *gorm.DB) domain.POSRepository {
	return &posRepository{db: db}
}

func (r *posRepository) SaveShift(ctx context.Context, shift *domain.Shift) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"closing_balance", "expected_balance", "discrepancy", "status", "client_closed_at"}),
	}).Create(shift).Error
}

func (r *posRepository) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	db := database.GetDB(ctx, r.db)
	var s domain.Shift
	if err := db.WithContext(ctx).Where("id = ?", id).First(&s).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("shift not found")
		}
		return nil, err
	}
	return &s, nil
}

func (r *posRepository) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	db := database.GetDB(ctx, r.db)
	// Create transaction with its items. We use OnConflict DoNothing for idempotency on the main transaction level.
	// If it already exists, we do nothing to prevent double processing.
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(trx).Error
}

func (r *posRepository) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)
	var t domain.Transaction
	if err := db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	return &t, nil
}

func (r *posRepository) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)
	var transactions []*domain.Transaction
	
	err := db.WithContext(ctx).
		Where("outlet_id = ?", outletID).
		Preload("Items").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&transactions).Error
		
	return transactions, err
}

func (r *posRepository) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.Transaction{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       status,
		"cancel_notes": cancelNotes,
	}).Error
}

func (r *posRepository) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(waste).Error
}

func (r *posRepository) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	db := database.GetDB(ctx, r.db)
	var w domain.ProductWaste
	if err := db.WithContext(ctx).Where("id = ?", id).First(&w).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("product waste not found")
		}
		return nil, err
	}
	return &w, nil
}

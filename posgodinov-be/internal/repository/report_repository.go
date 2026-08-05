package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type reportRepository struct {
	db *gorm.DB
}

func NewReportRepository(db *gorm.DB) domain.ReportRepository {
	return &reportRepository{db: db}
}

func (r *reportRepository) applyFilter(tx *gorm.DB, filter domain.ReportFilter) *gorm.DB {
	tx = tx.Where("business_id = ?", filter.BusinessID)
	if filter.OutletID != "" {
		tx = tx.Where("outlet_id = ?", filter.OutletID)
	}
	if filter.StartDate != "" {
		tx = tx.Where("DATE(created_at) >= ?", filter.StartDate)
	}
	if filter.EndDate != "" {
		tx = tx.Where("DATE(created_at) <= ?", filter.EndDate)
	}
	return tx
}

func (r *reportRepository) GetDashboardStats(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardStats, error) {
	db := database.GetDB(ctx, r.db)
	stats := &domain.DashboardStats{}

	// Total Revenue & Transactions (Hanya yang COMPLETED)
	txTrx := r.applyFilter(db.Model(&domain.Transaction{}), filter).Where("status = ?", "COMPLETED")
	txTrx.Select("COALESCE(SUM(total_amount), 0)").Row().Scan(&stats.TotalRevenue)
	txTrx.Count(&stats.TotalTransactions)

	// Total Wastes (Dalam kuantitas item/gelas)
	txWaste := r.applyFilter(db.Model(&domain.ProductWaste{}), filter)
	txWaste.Select("COALESCE(SUM(quantity), 0)").Row().Scan(&stats.TotalWastes)

	// Total Discrepancy (Dari Shift yang CLOSED)
	txShift := r.applyFilter(db.Model(&domain.Shift{}), filter).Where("status = ?", "CLOSED")
	txShift.Select("COALESCE(SUM(discrepancy), 0)").Row().Scan(&stats.TotalDiscrepancy)

	return stats, nil
}

func (r *reportRepository) GetTopProducts(ctx context.Context, filter domain.ReportFilter, limit int) ([]*domain.TopProduct, error) {
	db := database.GetDB(ctx, r.db)
	var topProducts []*domain.TopProduct

	// Kita perlu join transaction_items dengan transactions untuk filter tgl dan status COMPLETED
	query := db.WithContext(ctx).Table("transaction_items").
		Select("transaction_items.product_id, products.name as product_name, SUM(transaction_items.quantity) as quantity_sold").
		Joins("JOIN transactions ON transactions.id = transaction_items.transaction_id").
		Joins("JOIN products ON products.id = transaction_items.product_id").
		Where("transactions.business_id = ?", filter.BusinessID).
		Where("transactions.status = ?", "COMPLETED")

	if filter.OutletID != "" {
		query = query.Where("transactions.outlet_id = ?", filter.OutletID)
	}
	if filter.StartDate != "" {
		query = query.Where("DATE(transactions.created_at) >= ?", filter.StartDate)
	}
	if filter.EndDate != "" {
		query = query.Where("DATE(transactions.created_at) <= ?", filter.EndDate)
	}

	err := query.Group("transaction_items.product_id, products.name").
		Order("quantity_sold DESC").
		Limit(limit).
		Scan(&topProducts).Error

	return topProducts, err
}

func (r *reportRepository) GetTransactions(ctx context.Context, filter domain.ReportFilter) ([]*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)
	var transactions []*domain.Transaction
	
	query := r.applyFilter(db.WithContext(ctx).Model(&domain.Transaction{}), filter)
	// Preload items untuk detail lengkap
	err := query.Preload("Items").Order("created_at DESC").Find(&transactions).Error
	
	return transactions, err
}

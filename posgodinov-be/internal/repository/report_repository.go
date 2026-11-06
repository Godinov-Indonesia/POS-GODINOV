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

func (r *reportRepository) applyFilterCol(tx *gorm.DB, filter domain.ReportFilter, dateCol string) *gorm.DB {
	tx = tx.Where("business_id = ?", filter.BusinessID)
	if filter.OutletID != "" {
		tx = tx.Where("outlet_id = ?", filter.OutletID)
	}
	if filter.StartDate != "" {
		tx = tx.Where(dateCol+" >= ?::date", filter.StartDate)
	}
	if filter.EndDate != "" {
		tx = tx.Where(dateCol+" < (?::date + INTERVAL '1 day')", filter.EndDate)
	}
	return tx
}

func (r *reportRepository) applyFilter(tx *gorm.DB, filter domain.ReportFilter) *gorm.DB {
	return r.applyFilterCol(tx, filter, "COALESCE(client_created_at, created_at)")
}

func (r *reportRepository) GetDashboardStats(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardStats, error) {
	db := database.GetDB(ctx, r.db)
	stats := &domain.DashboardStats{}

	// Total Revenue & Transactions (Hanya yang COMPLETED, dikurangi retur)
	txTrx := r.applyFilterCol(db.Model(&domain.Transaction{}), filter, "COALESCE(client_created_at, created_at)").Where("status = ?", "COMPLETED")
	txTrx.Select("COALESCE(SUM(total_amount), 0)").Row().Scan(&stats.TotalRevenue)
	txTrx.Count(&stats.TotalTransactions)

	var totalRefunds float64
	txRet := r.applyFilterCol(db.Model(&domain.Return{}), filter, "COALESCE(client_created_at, created_at)")
	txRet.Select("COALESCE(SUM(refund_amount), 0)").Row().Scan(&totalRefunds)
	stats.TotalRevenue -= totalRefunds

	// Total Wastes (Dalam kuantitas item/gelas)
	txWaste := r.applyFilterCol(db.Model(&domain.ProductWaste{}), filter, "created_at")
	txWaste.Select("COALESCE(SUM(quantity), 0)").Row().Scan(&stats.TotalWastes)

	// Total Discrepancy (Dari Shift yang CLOSED)
	txShift := r.applyFilterCol(db.Model(&domain.Shift{}), filter, "COALESCE(client_opened_at, created_at)").Where("status = ?", "CLOSED")
	txShift.Select("COALESCE(SUM(discrepancy), 0)").Row().Scan(&stats.TotalDiscrepancy)

	return stats, nil
}

func (r *reportRepository) GetTopProducts(ctx context.Context, filter domain.ReportFilter, limit int) ([]*domain.TopProduct, error) {
	db := database.GetDB(ctx, r.db)
	var topProducts []*domain.TopProduct

	// Kita perlu join transaction_items dengan transactions untuk filter tgl dan status COMPLETED, dikurangi return_items
	query := db.WithContext(ctx).Table("transaction_items").
		Select(`transaction_items.product_id, products.name as product_name,
			SUM(transaction_items.quantity - COALESCE((
				SELECT SUM(ri.quantity) FROM return_items ri WHERE ri.transaction_item_id = transaction_items.id
			), 0)) as quantity_sold`).
		Joins("JOIN transactions ON transactions.id = transaction_items.transaction_id").
		Joins("JOIN products ON products.id = transaction_items.product_id").
		Where("transactions.business_id = ?", filter.BusinessID).
		Where("transactions.status = ?", "COMPLETED")

	if filter.OutletID != "" {
		query = query.Where("transactions.outlet_id = ?", filter.OutletID)
	}
	if filter.StartDate != "" {
		query = query.Where("COALESCE(transactions.client_created_at, transactions.created_at) >= ?::date", filter.StartDate)
	}
	if filter.EndDate != "" {
		query = query.Where("COALESCE(transactions.client_created_at, transactions.created_at) < (?::date + INTERVAL '1 day')", filter.EndDate)
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
	// Preload items untuk detail lengkap, batasi maksimal 5000 baris agar mencegah OOM
	err := query.Preload("Items").Order("COALESCE(client_created_at, created_at) DESC").Limit(5000).Find(&transactions).Error

	return transactions, err
}

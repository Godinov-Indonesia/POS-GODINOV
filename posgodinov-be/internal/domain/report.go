package domain

import (
	"context"
)

type DashboardStats struct {
	TotalRevenue      float64 `json:"total_revenue"`
	TotalTransactions int64   `json:"total_transactions"`
	TotalWastes       int64   `json:"total_wastes"`
	TotalDiscrepancy  float64 `json:"total_discrepancy"`
}

type TopProduct struct {
	ProductID    string `json:"product_id"`
	ProductName  string `json:"product_name"`
	QuantitySold int64  `json:"quantity_sold"`
}

type DashboardResponse struct {
	Stats       *DashboardStats `json:"stats"`
	TopProducts []*TopProduct   `json:"top_products"`
}

type ReportFilter struct {
	BusinessID string
	OutletID   string // Optional, if empty means all outlets
	StartDate  string // Format: YYYY-MM-DD
	EndDate    string // Format: YYYY-MM-DD
}

type ReportRepository interface {
	GetDashboardStats(ctx context.Context, filter ReportFilter) (*DashboardStats, error)
	GetTopProducts(ctx context.Context, filter ReportFilter, limit int) ([]*TopProduct, error)
	GetTransactions(ctx context.Context, filter ReportFilter) ([]*Transaction, error)
}

type ReportService interface {
	GetDashboard(ctx context.Context, filter ReportFilter) (*DashboardResponse, error)
	GetTransactions(ctx context.Context, filter ReportFilter) ([]*Transaction, error)
}

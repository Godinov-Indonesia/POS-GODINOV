package unit

import (
	"context"
	"errors"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockReportRepository struct {
	Stats        *domain.DashboardStats
	TopProducts  []*domain.TopProduct
	Transactions []*domain.Transaction
	LastFilter   domain.ReportFilter
	Err          error
}

func (m *MockReportRepository) GetDashboardStats(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardStats, error) {
	m.LastFilter = filter
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Stats, nil
}

func (m *MockReportRepository) GetTopProducts(ctx context.Context, filter domain.ReportFilter, limit int) ([]*domain.TopProduct, error) {
	m.LastFilter = filter
	if m.Err != nil {
		return nil, m.Err
	}
	// limit mock manually if needed
	if limit > 0 && len(m.TopProducts) > limit {
		return m.TopProducts[:limit], nil
	}
	return m.TopProducts, nil
}

func (m *MockReportRepository) GetTransactions(ctx context.Context, filter domain.ReportFilter) ([]*domain.Transaction, error) {
	m.LastFilter = filter
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Transactions, nil
}

func TestReportService_GetDashboard(t *testing.T) {
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		repo := &MockReportRepository{
			Stats: &domain.DashboardStats{
				TotalRevenue:      100000,
				TotalTransactions: 10,
				TotalWastes:       2,
				TotalDiscrepancy:  500,
			},
			TopProducts: []*domain.TopProduct{
				{ProductID: "p1", ProductName: "Kopi", QuantitySold: 5},
			},
		}

		svc := service.NewReportService(repo)
		filter := domain.ReportFilter{BusinessID: "b1"}

		res, err := svc.GetDashboard(ctx, filter)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Stats.TotalRevenue != 100000 {
			t.Errorf("expected revenue 100000, got %v", res.Stats.TotalRevenue)
		}
		if len(res.TopProducts) != 1 {
			t.Errorf("expected 1 top product, got %v", len(res.TopProducts))
		}
	})

	t.Run("Error from repo", func(t *testing.T) {
		repo := &MockReportRepository{
			Err: errors.New("db error"),
		}

		svc := service.NewReportService(repo)
		filter := domain.ReportFilter{BusinessID: "b1"}

		_, err := svc.GetDashboard(ctx, filter)
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

func TestReportService_GetTransactions(t *testing.T) {
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		repo := &MockReportRepository{
			Transactions: []*domain.Transaction{
				{ID: "tx1", TotalAmount: 10000},
			},
		}

		svc := service.NewReportService(repo)
		filter := domain.ReportFilter{BusinessID: "b1"}

		res, err := svc.GetTransactions(ctx, filter)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if len(res) != 1 {
			t.Errorf("expected 1 transaction, got %v", len(res))
		}
	})

	t.Run("Error from repo", func(t *testing.T) {
		repo := &MockReportRepository{
			Err: errors.New("db error"),
		}

		svc := service.NewReportService(repo)
		filter := domain.ReportFilter{BusinessID: "b1"}

		_, err := svc.GetTransactions(ctx, filter)
		if err == nil {
			t.Error("expected error, got nil")
		}
	})

	t.Run("Clamps StartDate to history_days_limit via PolicyEngine", func(t *testing.T) {
		repo := &MockReportRepository{
			Transactions: []*domain.Transaction{},
		}
		pe := &mockM6PolicyEngine{
			numericLimits: map[string]int64{"history_days_limit": 7},
		}
		svc := service.NewReportService(repo, service.WithReportPolicyEngine(pe))
		filter := domain.ReportFilter{
			BusinessID: "b1",
			StartDate:  "2020-01-01",
		}

		_, err := svc.GetTransactions(ctx, filter)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		expectedStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		if repo.LastFilter.StartDate != expectedStart {
			t.Errorf("expected clamped StartDate %s, got %s", expectedStart, repo.LastFilter.StartDate)
		}
	})
}

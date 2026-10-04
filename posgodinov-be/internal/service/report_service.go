package service

import (
	"context"
	"time"

	"posgodinov-backend/internal/domain"
)

type ReportServiceOption func(*reportService)

func WithReportPolicyEngine(pe domain.PolicyEngine) ReportServiceOption {
	return func(s *reportService) {
		s.policyEngine = pe
	}
}

type reportService struct {
	reportRepo   domain.ReportRepository
	policyEngine domain.PolicyEngine
}

func NewReportService(reportRepo domain.ReportRepository, opts ...ReportServiceOption) domain.ReportService {
	s := &reportService{
		reportRepo: reportRepo,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *reportService) clampFilterDate(ctx context.Context, filter *domain.ReportFilter) {
	if s.policyEngine == nil || filter.BusinessID == "" {
		return
	}
	limit, err := s.policyEngine.GetNumericLimit(ctx, filter.BusinessID, "history_days_limit")
	if err != nil || limit <= 0 {
		return
	}

	earliestDate := time.Now().AddDate(0, 0, -int(limit)).Format("2006-01-02")
	if filter.StartDate == "" || filter.StartDate < earliestDate {
		filter.StartDate = earliestDate
	}
}

func (s *reportService) GetDashboard(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardResponse, error) {
	s.clampFilterDate(ctx, &filter)

	stats, err := s.reportRepo.GetDashboardStats(ctx, filter)
	if err != nil {
		return nil, err
	}

	topProducts, err := s.reportRepo.GetTopProducts(ctx, filter, 5)
	if err != nil {
		return nil, err
	}

	return &domain.DashboardResponse{
		Stats:       stats,
		TopProducts: topProducts,
	}, nil
}

func (s *reportService) GetTransactions(ctx context.Context, filter domain.ReportFilter) ([]*domain.Transaction, error) {
	s.clampFilterDate(ctx, &filter)
	return s.reportRepo.GetTransactions(ctx, filter)
}

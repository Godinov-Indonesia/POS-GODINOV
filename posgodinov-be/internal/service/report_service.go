package service

import (
	"context"

	"posgodinov-backend/internal/domain"
)

type reportService struct {
	reportRepo domain.ReportRepository
}

func NewReportService(reportRepo domain.ReportRepository) domain.ReportService {
	return &reportService{
		reportRepo: reportRepo,
	}
}

func (s *reportService) GetDashboard(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardResponse, error) {
	stats, err := s.reportRepo.GetDashboardStats(ctx, filter)
	if err != nil {
		return nil, err
	}

	topProducts, err := s.reportRepo.GetTopProducts(ctx, filter, 5) // Ambil Top 5
	if err != nil {
		return nil, err
	}

	return &domain.DashboardResponse{
		Stats:       stats,
		TopProducts: topProducts,
	}, nil
}

func (s *reportService) GetTransactions(ctx context.Context, filter domain.ReportFilter) ([]*domain.Transaction, error) {
	return s.reportRepo.GetTransactions(ctx, filter)
}

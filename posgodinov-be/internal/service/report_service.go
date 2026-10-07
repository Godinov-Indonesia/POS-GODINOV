package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"posgodinov-backend/internal/domain"
)

type ReportServiceOption func(*reportService)

func WithReportPolicyEngine(pe domain.PolicyEngine) ReportServiceOption {
	return func(s *reportService) {
		s.policyEngine = pe
	}
}

func WithReportWasteLogRepo(r domain.WasteLogRepository) ReportServiceOption {
	return func(s *reportService) {
		s.wasteRepo = r
	}
}

func WithReportRestockLogRepo(r domain.RestockLogRepository) ReportServiceOption {
	return func(s *reportService) {
		s.restockRepo = r
	}
}

type reportService struct {
	reportRepo   domain.ReportRepository
	wasteRepo    domain.WasteLogRepository
	restockRepo  domain.RestockLogRepository
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

func (s *reportService) Export(ctx context.Context, reportType string, filter domain.ReportFilter) (interface{}, error) {
	if s.policyEngine != nil && filter.BusinessID != "" {
		if err := s.policyEngine.AssertFeature(ctx, filter.BusinessID, "export_reports"); err != nil {
			return nil, err
		}
	}
	s.clampFilterDate(ctx, &filter)

	switch reportType {
	case "transactions":
		return s.reportRepo.GetTransactions(ctx, filter)
	case "waste":
		if s.wasteRepo == nil {
			return nil, errors.New("waste repository tidak terkonfigurasi")
		}
		return s.wasteRepo.GetAllByOutletID(ctx, filter.OutletID)
	case "restock":
		if s.restockRepo == nil {
			return nil, errors.New("restock repository tidak terkonfigurasi")
		}
		return s.restockRepo.GetAllByOutletID(ctx, filter.OutletID)
	default:
		return nil, fmt.Errorf("tipe laporan '%s' tidak valid untuk diekspor", reportType)
	}
}

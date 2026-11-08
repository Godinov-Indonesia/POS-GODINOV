package unit

import (
	"context"
	"errors"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockShiftReconcileRepository struct {
	TenderTotals *domain.ShiftTenderTotals
	ReconcileErr error
	Rows         []*domain.ShiftReconciliationRow
	ListErr      error
	Detail       *domain.ShiftDetailResponse
	DetailErr    error
}

func (m *MockShiftReconcileRepository) TenderTotalsOfShift(ctx context.Context, shiftID string) (*domain.ShiftTenderTotals, error) {
	if m.ReconcileErr != nil {
		return nil, m.ReconcileErr
	}
	return m.TenderTotals, nil
}

func (m *MockShiftReconcileRepository) UpdateShiftReconciliation(ctx context.Context, r *domain.ShiftReconciliation) error {
	return m.ReconcileErr
}

func (m *MockShiftReconcileRepository) ListReconciliation(ctx context.Context, f domain.ShiftReconciliationFilter) ([]*domain.ShiftReconciliationRow, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	return m.Rows, nil
}

func (m *MockShiftReconcileRepository) GetShiftDetail(ctx context.Context, businessID, outletID, shiftID string) (*domain.ShiftDetailResponse, error) {
	if m.DetailErr != nil {
		return nil, m.DetailErr
	}
	return m.Detail, nil
}

type MockPOSRepositoryForShift struct {
	Shift *domain.Shift
	Err   error
}

func (m *MockPOSRepositoryForShift) SaveShift(ctx context.Context, shift *domain.Shift) error {
	return m.Err
}
func (m *MockPOSRepositoryForShift) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Shift, nil
}
func (m *MockPOSRepositoryForShift) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	return nil
}
func (m *MockPOSRepositoryForShift) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	return nil, nil
}
func (m *MockPOSRepositoryForShift) LookupTransaction(ctx context.Context, outletID, code string) (*domain.Transaction, error) {
	return nil, nil
}
func (m *MockPOSRepositoryForShift) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	return nil, nil
}
func (m *MockPOSRepositoryForShift) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	return nil
}
func (m *MockPOSRepositoryForShift) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	return nil
}
func (m *MockPOSRepositoryForShift) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	return nil, nil
}

func TestShiftReconcileService_GetDetail(t *testing.T) {
	posRepo := &MockPOSRepositoryForShift{}
	reconcileRepo := &MockShiftReconcileRepository{}
	svc := service.NewShiftReconcileService(posRepo, reconcileRepo)
	ctx := context.Background()

	t.Run("Empty parameters return error", func(t *testing.T) {
		_, err := svc.GetDetail(ctx, "", "out_01", "shf_01")
		if err == nil {
			t.Fatal("expected error for empty businessID")
		}
		_, err = svc.GetDetail(ctx, "biz_01", "", "shf_01")
		if err == nil {
			t.Fatal("expected error for empty outletID")
		}
		_, err = svc.GetDetail(ctx, "biz_01", "out_01", "")
		if err == nil {
			t.Fatal("expected error for empty shiftID")
		}
	})

	t.Run("Repository error propagates", func(t *testing.T) {
		reconcileRepo.DetailErr = errors.New("db error")
		_, err := svc.GetDetail(ctx, "biz_01", "out_01", "shf_01")
		if err == nil {
			t.Fatal("expected error")
		}
		reconcileRepo.DetailErr = nil
	})

	t.Run("Success with threshold and flagged calculated", func(t *testing.T) {
		cashVariance := -6000.0 // melebihi VarianceThreshold (5000)
		reconcileRepo.Detail = &domain.ShiftDetailResponse{
			ShiftSummary: domain.ShiftSummary{
				ShiftID:  "shf_01",
				OutletID: "out_01",
				OpenedAt: time.Now(),
				Cash: domain.ShiftVarianceDetail{
					Declared: 100000,
					Expected: &cashVariance,
					Variance: &cashVariance,
				},
			},
			TransactionsMetric: domain.ShiftTransactionsMetric{
				TotalCount:     1,
				CompletedCount: 1,
				Transactions: []domain.ShiftTransactionRecord{
					{
						ID:          "tx_01",
						ReceiptCode: "RCP-001",
						Items: []domain.ShiftTransactionItem{
							{
								ID:          "item_01",
								ProductID:   "prd_01",
								ProductName: "Kopi Susu",
								SKU:         "COF-01",
								Quantity:    2,
								UnitPrice:   18000,
								Subtotal:    36000,
							},
						},
					},
				},
			},
		}

		res, err := svc.GetDetail(ctx, "biz_01", "out_01", "shf_01")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.ShiftSummary.VarianceThreshold != service.VarianceThreshold {
			t.Errorf("expected threshold %v, got %v", service.VarianceThreshold, res.ShiftSummary.VarianceThreshold)
		}
		if !res.ShiftSummary.Flagged {
			t.Errorf("expected shift to be flagged when variance exceeds 5000")
		}
		if len(res.TransactionsMetric.Transactions[0].Items) != 1 {
			t.Fatalf("expected 1 transaction item, got %d", len(res.TransactionsMetric.Transactions[0].Items))
		}
		if res.TransactionsMetric.Transactions[0].Items[0].SKU != "COF-01" {
			t.Errorf("expected SKU COF-01, got %s", res.TransactionsMetric.Transactions[0].Items[0].SKU)
		}
	})
}

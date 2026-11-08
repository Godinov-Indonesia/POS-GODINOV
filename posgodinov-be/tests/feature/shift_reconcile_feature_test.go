package feature

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gorm.io/gorm"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockFeatureShiftReconcileRepo struct {
	Detail    *domain.ShiftDetailResponse
	DetailErr error
}

func (m *MockFeatureShiftReconcileRepo) TenderTotalsOfShift(ctx context.Context, shiftID string) (*domain.ShiftTenderTotals, error) {
	return nil, nil
}
func (m *MockFeatureShiftReconcileRepo) UpdateShiftReconciliation(ctx context.Context, r *domain.ShiftReconciliation) error {
	return nil
}
func (m *MockFeatureShiftReconcileRepo) ListReconciliation(ctx context.Context, f domain.ShiftReconciliationFilter) ([]*domain.ShiftReconciliationRow, error) {
	return nil, nil
}
func (m *MockFeatureShiftReconcileRepo) GetShiftDetail(ctx context.Context, businessID, outletID, shiftID string) (*domain.ShiftDetailResponse, error) {
	if m.DetailErr != nil {
		return nil, m.DetailErr
	}
	return m.Detail, nil
}

type MockFeaturePOSRepo struct{}

func (m *MockFeaturePOSRepo) SaveShift(ctx context.Context, shift *domain.Shift) error { return nil }
func (m *MockFeaturePOSRepo) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	return nil, nil
}
func (m *MockFeaturePOSRepo) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	return nil
}
func (m *MockFeaturePOSRepo) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	return nil, nil
}
func (m *MockFeaturePOSRepo) LookupTransaction(ctx context.Context, outletID, code string) (*domain.Transaction, error) {
	return nil, nil
}
func (m *MockFeaturePOSRepo) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	return nil, nil
}
func (m *MockFeaturePOSRepo) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	return nil
}
func (m *MockFeaturePOSRepo) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	return nil
}
func (m *MockFeaturePOSRepo) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	return nil, nil
}

func TestShiftReconcileHandler_GetDetail(t *testing.T) {
	mockRepo := &MockFeatureShiftReconcileRepo{}
	svc := service.NewShiftReconcileService(&MockFeaturePOSRepo{}, mockRepo)
	h := handler.NewShiftReconcileHandler(svc)

	bizPayload := &token.Payload{
		ID:   "biz_001",
		Role: "business",
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/shift-reconciliation/{shift_id}", mockAuthMiddleware(bizPayload, h.GetDetail))

	t.Run("Returns 404 when shift not found", func(t *testing.T) {
		mockRepo.DetailErr = gorm.ErrRecordNotFound
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/out_001/reports/shift-reconciliation/shf_unknown", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected status 404, got %d", rec.Code)
		}
		mockRepo.DetailErr = nil
	})

	t.Run("Returns 200 with shift detail including transaction items", func(t *testing.T) {
		mockRepo.Detail = &domain.ShiftDetailResponse{
			ShiftSummary: domain.ShiftSummary{
				ShiftID:        "shf_123",
				OutletID:       "out_001",
				StaffID:        "usr_01",
				StaffName:      "Kasir Joni",
				DeviceID:       "POS-1",
				Status:         "CLOSED",
				BlindClose:     true,
				OpenedAt:       time.Now(),
				OpeningBalance: 50000,
			},
			TransactionsMetric: domain.ShiftTransactionsMetric{
				TotalCount:     1,
				CompletedCount: 1,
				Transactions: []domain.ShiftTransactionRecord{
					{
						ID:          "tx_01",
						ReceiptCode: "RCP-001",
						TotalAmount: 35000,
						Items: []domain.ShiftTransactionItem{
							{
								ID:          "item_01",
								ProductID:   "prd_01",
								ProductName: "Kopi Latte",
								SKU:         "COF-LAT-01",
								Quantity:    1,
								UnitPrice:   35000,
								Subtotal:    35000,
							},
						},
					},
				},
			},
		}

		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/out_001/reports/shift-reconciliation/shf_123", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d, body: %s", rec.Code, rec.Body.String())
		}

		var resp struct {
			Status  string                     `json:"status"`
			Message string                     `json:"message"`
			Data    domain.ShiftDetailResponse `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Data.ShiftSummary.ShiftID != "shf_123" {
			t.Errorf("expected shift_id shf_123, got %s", resp.Data.ShiftSummary.ShiftID)
		}
		if len(resp.Data.TransactionsMetric.Transactions) != 1 {
			t.Fatalf("expected 1 transaction, got %d", len(resp.Data.TransactionsMetric.Transactions))
		}
		tx := resp.Data.TransactionsMetric.Transactions[0]
		if len(tx.Items) != 1 {
			t.Fatalf("expected 1 item, got %d", len(tx.Items))
		}
		if tx.Items[0].ProductName != "Kopi Latte" || tx.Items[0].SKU != "COF-LAT-01" {
			t.Errorf("unexpected item fields: %+v", tx.Items[0])
		}
	})
}

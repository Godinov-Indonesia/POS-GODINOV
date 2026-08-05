package unit

import (
	"context"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockWasteLogRepository struct {
	logs []*domain.WasteLog
}

func (m *MockWasteLogRepository) Create(ctx context.Context, log *domain.WasteLog) error {
	m.logs = append(m.logs, log)
	return nil
}

func (m *MockWasteLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.WasteLog, error) {
	var result []*domain.WasteLog
	for _, l := range m.logs {
		if l.OutletID == outletID {
			result = append(result, l)
		}
	}
	return result, nil
}

func TestWasteLogService(t *testing.T) {
	ctx := context.Background()

	wasteRepo := &MockWasteLogRepository{}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu", Stock: 100},
		},
	}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	txManager := database.NewMockTransactionManager()

	svc := service.NewWasteLogService(wasteRepo, rmRepo, outletRepo, txManager)

	t.Run("Valid Waste Record", func(t *testing.T) {
		req := &domain.CreateWasteLogRequest{
			Quantity: 10,
			Reason:   "Tumpah",
		}
		res, err := svc.RecordWaste(ctx, "b1", "o1", "rm1", "actor-1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Quantity != 10 {
			t.Errorf("expected 10, got %f", res.Quantity)
		}
		
		// Verify stock decreased
		rm, _ := rmRepo.GetByID(ctx, "rm1")
		if rm.Stock != 90 {
			t.Errorf("expected stock to be 90, got %f", rm.Stock)
		}
	})

	t.Run("Insufficient Stock", func(t *testing.T) {
		req := &domain.CreateWasteLogRequest{
			Quantity: 1000,
			Reason:   "Tumpah",
		}
		_, err := svc.RecordWaste(ctx, "b1", "o1", "rm1", "actor-1", req)
		if err == nil {
			t.Error("expected error due to insufficient stock, got nil")
		}
	})
}

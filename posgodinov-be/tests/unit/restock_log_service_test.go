package unit

import (
	"context"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockRestockLogRepository struct {
	logs []*domain.RestockLog
}

func (m *MockRestockLogRepository) Create(ctx context.Context, log *domain.RestockLog) error {
	m.logs = append(m.logs, log)
	return nil
}

func (m *MockRestockLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RestockLog, error) {
	return m.logs, nil
}

func TestRestockLogService(t *testing.T) {
	ctx := context.Background()
	restockRepo := &MockRestockLogRepository{}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu", Stock: 10, CostPerUnit: 1000},
		},
	}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{{ID: "o1", BusinessID: "b1"}},
	}
	txManager := database.NewMockTransactionManager()
	svc := service.NewRestockLogService(restockRepo, rmRepo, outletRepo, txManager)

	t.Run("Valid Restock (Moving Average)", func(t *testing.T) {
		req := &domain.CreateRestockLogRequest{
			Quantity:    10,
			CostPerUnit: 2000,
		}
		res, err := svc.RecordRestock(ctx, "b1", "o1", "rm1", "actor1", req)
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
		if res.TotalCost != 20000 {
			t.Errorf("expected 20000, got %f", res.TotalCost)
		}
		
		rm, _ := rmRepo.GetByID(ctx, "rm1")
		if rm.Stock != 20 {
			t.Errorf("expected stock 20, got %f", rm.Stock)
		}
		// old value: 10 * 1000 = 10000
		// new value: 10 * 2000 = 20000
		// total value = 30000. total stock = 20. new cost = 30000/20 = 1500
		if rm.CostPerUnit != 1500 {
			t.Errorf("expected new cost 1500, got %f", rm.CostPerUnit)
		}
	})
}

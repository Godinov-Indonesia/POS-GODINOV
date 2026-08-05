package unit

import (
	"context"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockStockOpnameRepository struct {
	opnames []*domain.StockOpname
}

func (m *MockStockOpnameRepository) Create(ctx context.Context, opname *domain.StockOpname) error {
	m.opnames = append(m.opnames, opname)
	return nil
}

func (m *MockStockOpnameRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.StockOpname, error) {
	var result []*domain.StockOpname
	for _, l := range m.opnames {
		if l.OutletID == outletID {
			result = append(result, l)
		}
	}
	return result, nil
}

func TestStockOpnameService(t *testing.T) {
	ctx := context.Background()

	opnameRepo := &MockStockOpnameRepository{}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu", Stock: 100},
			{ID: "rm2", OutletID: "o1", Name: "Gula", Stock: 0},
		},
	}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	txManager := database.NewMockTransactionManager()

	svc := service.NewStockOpnameService(opnameRepo, rmRepo, outletRepo, txManager)

	t.Run("Valid Opname No Fraud", func(t *testing.T) {
		req := &domain.CreateStockOpnameRequest{
			ActualStock: 96,
		}
		res, err := svc.RecordOpname(ctx, "b1", "o1", "rm1", "actor-1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Difference != -4 {
			t.Errorf("expected difference -4, got %f", res.Difference)
		}
		if res.FraudFlag {
			t.Error("expected fraud flag false, got true")
		}
		
		rm, _ := rmRepo.GetByID(ctx, "rm1")
		if rm.Stock != 96 {
			t.Errorf("expected stock to be 96, got %f", rm.Stock)
		}
	})

	t.Run("Valid Opname With Fraud", func(t *testing.T) {
		req := &domain.CreateStockOpnameRequest{
			ActualStock: 80, // system stock is now 96, diff is -16, which is > 5%
		}
		res, err := svc.RecordOpname(ctx, "b1", "o1", "rm1", "actor-1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Difference != -16 {
			t.Errorf("expected difference -16, got %f", res.Difference)
		}
		if !res.FraudFlag {
			t.Error("expected fraud flag true, got false")
		}
	})
	
	t.Run("Opname Zero to Positive With Fraud", func(t *testing.T) {
		req := &domain.CreateStockOpnameRequest{
			ActualStock: 10, // system stock is 0
		}
		res, err := svc.RecordOpname(ctx, "b1", "o1", "rm2", "actor-1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Difference != 10 {
			t.Errorf("expected difference 10, got %f", res.Difference)
		}
		if !res.FraudFlag {
			t.Error("expected fraud flag true, got false")
		}
	})
}

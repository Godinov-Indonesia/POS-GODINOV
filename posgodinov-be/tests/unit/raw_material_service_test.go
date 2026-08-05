package unit

import (
	"context"
	"errors"
	"testing"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockRawMaterialRepository struct {
	rawMaterials []*domain.RawMaterial
}

func (m *MockRawMaterialRepository) Create(ctx context.Context, rm *domain.RawMaterial) error {
	m.rawMaterials = append(m.rawMaterials, rm)
	return nil
}

func (m *MockRawMaterialRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RawMaterial, error) {
	var result []*domain.RawMaterial
	for _, rm := range m.rawMaterials {
		if rm.OutletID == outletID {
			result = append(result, rm)
		}
	}
	return result, nil
}

func (m *MockRawMaterialRepository) GetByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	for _, rm := range m.rawMaterials {
		if rm.ID == id {
			return rm, nil
		}
	}
	return nil, errors.New("raw material not found")
}

func (m *MockRawMaterialRepository) LockByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	return m.GetByID(ctx, id)
}

func (m *MockRawMaterialRepository) UpdateStock(ctx context.Context, id string, newStock float64) error {
	for i, rm := range m.rawMaterials {
		if rm.ID == id {
			m.rawMaterials[i].Stock = newStock
			return nil
		}
	}
	return errors.New("not found")
}

func (m *MockRawMaterialRepository) UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error {
	for i, rm := range m.rawMaterials {
		if rm.ID == id {
			m.rawMaterials[i].Stock = newStock
			m.rawMaterials[i].CostPerUnit = newCost
			return nil
		}
	}
	return errors.New("not found")
}

func TestRawMaterialService(t *testing.T) {
	ctx := context.Background()

	rmRepo := &MockRawMaterialRepository{}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
			{ID: "o2", BusinessID: "b2"},
		},
	}

	svc := service.NewRawMaterialService(rmRepo, outletRepo)

	t.Run("Valid Create", func(t *testing.T) {
		req := &domain.CreateRawMaterialRequest{
			Name:        "Gula",
			Unit:        "kg",
			Stock:       10,
			CostPerUnit: 15000,
		}
		res, err := svc.Create(ctx, "b1", "o1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Name != "Gula" {
			t.Errorf("expected Gula, got %s", res.Name)
		}
	})

	t.Run("Create With Invalid Outlet", func(t *testing.T) {
		req := &domain.CreateRawMaterialRequest{Name: "Gula", Unit: "kg"}
		_, err := svc.Create(ctx, "b1", "o2", req)
		if err == nil {
			t.Error("expected error for wrong business id, got nil")
		}
	})
	
	t.Run("Get All Valid", func(t *testing.T) {
		res, err := svc.GetAllByOutlet(ctx, "b1", "o1")
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if len(res) != 1 {
			t.Errorf("expected 1 result, got %d", len(res))
		}
	})
}
func (m *MockRawMaterialRepository) Update(ctx context.Context, rm *domain.RawMaterial) error { return nil }
func (m *MockRawMaterialRepository) Delete(ctx context.Context, id string) error { return nil }

func (m *MockRawMaterialRepository) CreateBulk(ctx context.Context, rawMaterials []*domain.RawMaterial) error {
	return nil
}

func (m *MockRawMaterialRepository) GetByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}

func (m *MockRawMaterialRepository) LockByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}

package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockFeatureRawMaterialRepository struct {
	rawMaterials []*domain.RawMaterial
}

func (m *MockFeatureRawMaterialRepository) Create(ctx context.Context, rm *domain.RawMaterial) error {
	m.rawMaterials = append(m.rawMaterials, rm)
	return nil
}

func (m *MockFeatureRawMaterialRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RawMaterial, error) {
	var result []*domain.RawMaterial
	for _, rm := range m.rawMaterials {
		if rm.OutletID == outletID {
			result = append(result, rm)
		}
	}
	return result, nil
}

func (m *MockFeatureRawMaterialRepository) GetByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	for _, rm := range m.rawMaterials {
		if rm.ID == id {
			return rm, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockFeatureRawMaterialRepository) LockByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	return m.GetByID(ctx, id)
}

func (m *MockFeatureRawMaterialRepository) UpdateStock(ctx context.Context, id string, newStock float64) error {
	for i, rm := range m.rawMaterials {
		if rm.ID == id {
			m.rawMaterials[i].Stock = newStock
			return nil
		}
	}
	return errors.New("not found")
}

func (m *MockFeatureRawMaterialRepository) UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error {
	for i, rm := range m.rawMaterials {
		if rm.ID == id {
			m.rawMaterials[i].Stock = newStock
			m.rawMaterials[i].CostPerUnit = newCost
			return nil
		}
	}
	return errors.New("not found")
}

func TestFeatureRawMaterial(t *testing.T) {
	rmRepo := &MockFeatureRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu"},
		},
	}
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Cabang 1"},
		},
	}
	
	rmSvc := service.NewRawMaterialService(rmRepo, outletRepo)
	rmHandler := handler.NewRawMaterialHandler(rmSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials", authMw(rmHandler.Create))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/raw-materials", authMw(rmHandler.GetAll))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Create Raw Material", func(t *testing.T) {
		body := map[string]interface{}{
			"name":          "Gula Aren",
			"unit":          "gram",
			"stock":         1000,
			"cost_per_unit": 50,
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/raw-materials", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	})
	
	t.Run("Get All Raw Materials", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/o1/raw-materials", nil)
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})
}
func (m *MockFeatureRawMaterialRepository) Update(ctx context.Context, rm *domain.RawMaterial) error { return nil }
func (m *MockFeatureRawMaterialRepository) Delete(ctx context.Context, id string) error { return nil }

func (m *MockFeatureRawMaterialRepository) CreateBulk(ctx context.Context, rawMaterials []*domain.RawMaterial) error {
	return nil
}

func (m *MockFeatureRawMaterialRepository) GetByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}

func (m *MockFeatureRawMaterialRepository) LockByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}

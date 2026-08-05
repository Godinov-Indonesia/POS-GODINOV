package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockFeatureStockOpnameRepository struct {
	opnames []*domain.StockOpname
}

func (m *MockFeatureStockOpnameRepository) Create(ctx context.Context, opname *domain.StockOpname) error {
	m.opnames = append(m.opnames, opname)
	return nil
}

func (m *MockFeatureStockOpnameRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.StockOpname, error) {
	return m.opnames, nil
}

func TestFeatureStockOpname(t *testing.T) {
	opnameRepo := &MockFeatureStockOpnameRepository{}
	rmRepo := &MockFeatureRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu", Stock: 50},
		},
	}
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Cabang 1"},
		},
	}
	txManager := database.NewMockTransactionManager()
	
	opnameSvc := service.NewStockOpnameService(opnameRepo, rmRepo, outletRepo, txManager)
	opnameHandler := handler.NewStockOpnameHandler(opnameSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/opnames", authMw(opnameHandler.Record))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Record Opname", func(t *testing.T) {
		body := map[string]interface{}{
			"actual_stock": 45, // diff is -5, 5/50 = 10% (fraud)
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/raw-materials/rm1/opnames", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	})
}

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

type MockFeatureRestockLogRepository struct {
	logs []*domain.RestockLog
}

func (m *MockFeatureRestockLogRepository) Create(ctx context.Context, log *domain.RestockLog) error {
	m.logs = append(m.logs, log)
	return nil
}
func (m *MockFeatureRestockLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RestockLog, error) {
	return m.logs, nil
}

func TestFeatureRestockLog(t *testing.T) {
	restockRepo := &MockFeatureRestockLogRepository{}
	rmRepo := &MockFeatureRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu", Stock: 50},
		},
	}
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	txManager := database.NewMockTransactionManager()
	
	restockSvc := service.NewRestockLogService(restockRepo, rmRepo, outletRepo, txManager)
	restockHandler := handler.NewRestockLogHandler(restockSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/restock", authMw(restockHandler.Record))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Record Restock", func(t *testing.T) {
		body := map[string]interface{}{
			"quantity": 20,
			"cost_per_unit": 1000,
			"supplier_name": "Supplier A",
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/raw-materials/rm1/restock", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d", rr.Code)
		}
	})
}

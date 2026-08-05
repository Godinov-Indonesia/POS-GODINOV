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

type MockFeatureWasteLogRepository struct {
	logs []*domain.WasteLog
}

func (m *MockFeatureWasteLogRepository) Create(ctx context.Context, log *domain.WasteLog) error {
	m.logs = append(m.logs, log)
	return nil
}

func (m *MockFeatureWasteLogRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.WasteLog, error) {
	return m.logs, nil
}

func TestFeatureWasteLog(t *testing.T) {
	wasteRepo := &MockFeatureWasteLogRepository{}
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
	
	wasteSvc := service.NewWasteLogService(wasteRepo, rmRepo, outletRepo, txManager)
	wasteHandler := handler.NewWasteLogHandler(wasteSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/waste", authMw(wasteHandler.Record))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Record Waste", func(t *testing.T) {
		body := map[string]interface{}{
			"quantity": 5,
			"reason":   "Susu basi",
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/raw-materials/rm1/waste", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	})
}

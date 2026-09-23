package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"errors"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
)

type MockFeatureOutletRepository struct {
	outlets []*domain.Outlet
}

func (m *MockFeatureOutletRepository) Create(ctx context.Context, outlet *domain.Outlet) error {
	m.outlets = append(m.outlets, outlet)
	return nil
}

func (m *MockFeatureOutletRepository) CountByBusinessID(ctx context.Context, businessID string) (int64, error) {
	return int64(len(m.outlets)), nil
}

func (m *MockFeatureOutletRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Outlet, error) {
	var result []*domain.Outlet
	for _, o := range m.outlets {
		if o.BusinessID == businessID {
			result = append(result, o)
		}
	}
	return result, nil
}

func (m *MockFeatureOutletRepository) GetByID(ctx context.Context, id string) (*domain.Outlet, error) {
	for _, o := range m.outlets {
		if o.ID == id {
			return o, nil
		}
	}
	return nil, errors.New("outlet not found")
}

func (m *MockFeatureOutletRepository) GetBySerialOutlet(ctx context.Context, businessID string, serial string) (*domain.Outlet, error) {
	return nil, nil
}

func TestFeatureOutletRegistration(t *testing.T) {
	outletRepo := &MockFeatureOutletRepository{}
	businessRepo := &MockBusinessRepository{
		businesses: []*domain.Business{
			{
				ID:             "b1",
				SerialBusiness: "POS01",
			},
		},
	}

	txManager := database.NewMockTransactionManager()
	outletSvc := service.NewOutletService(outletRepo, businessRepo, txManager)
	outletHandler := handler.NewOutletHandler(outletSvc)
	
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets", authMw(outletHandler.Register))

	// Generate valid token
	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Valid Registration", func(t *testing.T) {
		payload := map[string]string{
			"name":    "Outlet Pusat",
			"address": "Jalan Raya",
		}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d", rr.Code)
		}
	})

	t.Run("Unauthorized - No Token", func(t *testing.T) {
		payload := map[string]string{
			"name": "Outlet Pusat",
		}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})
}

func TestFeatureGetAllOutlets(t *testing.T) {
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Cabang 1"},
			{ID: "o2", BusinessID: "b1", Name: "Cabang 2"},
		},
	}
	businessRepo := &MockBusinessRepository{}
	txManager := database.NewMockTransactionManager()
	
	outletSvc := service.NewOutletService(outletRepo, businessRepo, txManager)
	outletHandler := handler.NewOutletHandler(outletSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/business/outlets", authMw(outletHandler.GetAll))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Valid Get All", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets", nil)
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}

		// Verify response body
		var response map[string]interface{}
		json.NewDecoder(rr.Body).Decode(&response)
		
		data, ok := response["data"].([]interface{})
		if !ok || len(data) != 2 {
			t.Errorf("expected 2 outlets in response, got %v", response["data"])
		}
	})
}

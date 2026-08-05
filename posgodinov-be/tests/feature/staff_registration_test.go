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

type MockFeatureStaffRepository struct {
	staffs []*domain.Staff
}

func (m *MockFeatureStaffRepository) Create(ctx context.Context, staff *domain.Staff) error {
	m.staffs = append(m.staffs, staff)
	return nil
}

func (m *MockFeatureStaffRepository) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) {
	for _, s := range m.staffs {
		if s.OutletID == outletID && s.StaffIdentifier == staffIdentifier {
			return s, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockFeatureStaffRepository) GetByID(ctx context.Context, id string) (*domain.Staff, error) {
	return nil, errors.New("not found")
}

func (m *MockFeatureStaffRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	return nil, nil
}

func (m *MockFeatureStaffRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	return nil, nil
}

func (m *MockFeatureStaffRepository) Update(ctx context.Context, staff *domain.Staff) error {
	return nil
}

func (m *MockFeatureStaffRepository) Delete(ctx context.Context, id string) error {
	return nil
}

func TestFeatureStaffRegistration(t *testing.T) {
	staffRepo := &MockFeatureStaffRepository{}
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Cabang 1"},
		},
	}
	
	staffSvc := service.NewStaffService(staffRepo, outletRepo)
	staffHandler := handler.NewStaffHandler(staffSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/staff", authMw(staffHandler.RegisterStaff))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Valid Registration", func(t *testing.T) {
		body := map[string]string{
			"outlet_id":        "o1",
			"staff_identifier": "kasir_utama",
			"name":             "Kasir Utama",
			"pin":              "123456",
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/staff", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	})
	
	t.Run("Unauthorized - No Token", func(t *testing.T) {
		body := map[string]string{
			"outlet_id":        "o1",
			"staff_identifier": "kasir2",
			"name":             "Kasir Dua",
			"pin":              "123456",
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/staff", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})
}

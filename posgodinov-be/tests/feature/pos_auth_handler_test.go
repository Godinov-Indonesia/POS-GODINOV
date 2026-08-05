package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockBusinessRepositoryForAuth struct {
	businesses []*domain.Business
}
func (m *MockBusinessRepositoryForAuth) Create(ctx context.Context, b *domain.Business) error { return nil }
func (m *MockBusinessRepositoryForAuth) GetByEmail(ctx context.Context, email string) (*domain.Business, error) { return nil, nil }
func (m *MockBusinessRepositoryForAuth) GetByID(ctx context.Context, id string) (*domain.Business, error) { return nil, nil }
func (m *MockBusinessRepositoryForAuth) LockByID(ctx context.Context, id string) (*domain.Business, error) { return nil, nil }
func (m *MockBusinessRepositoryForAuth) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.SerialBusiness == serial {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

type MockOutletRepositoryForAuth struct {
	outlets []*domain.Outlet
}
func (m *MockOutletRepositoryForAuth) Create(ctx context.Context, o *domain.Outlet) error { return nil }
func (m *MockOutletRepositoryForAuth) CountByBusinessID(ctx context.Context, businessID string) (int64, error) { return 0, nil }
func (m *MockOutletRepositoryForAuth) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Outlet, error) { return nil, nil }
func (m *MockOutletRepositoryForAuth) GetByID(ctx context.Context, id string) (*domain.Outlet, error) { return nil, nil }
func (m *MockOutletRepositoryForAuth) GetBySerialTenant(ctx context.Context, businessID, serial string) (*domain.Outlet, error) {
	for _, o := range m.outlets {
		if o.BusinessID == businessID && o.SerialTenant == serial {
			return o, nil
		}
	}
	return nil, errors.New("outlet not found")
}

func TestPOSAuthHandler_BindDevice(t *testing.T) {
	mockBusinessRepo := &MockBusinessRepositoryForAuth{}
	mockOutletRepo := &MockOutletRepositoryForAuth{}
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")

	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	mockBusinessRepo.businesses = append(mockBusinessRepo.businesses, &domain.Business{
		ID:             "biz-1",
		SerialBusiness: "BIZ-001",
		Password:       string(hashedPass),
	})

	mockOutletRepo.outlets = append(mockOutletRepo.outlets, &domain.Outlet{
		ID:           "out-1",
		BusinessID:   "biz-1",
		SerialTenant: "OUT-001",
	})

	svc := service.NewPOSAuthService(mockBusinessRepo, mockOutletRepo, tokenMaker)
	h := handler.NewPOSAuthHandler(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/device/bind", h.BindDevice)

	t.Run("Valid Binding", func(t *testing.T) {
		reqBody := map[string]string{
			"serial_business": "BIZ-001",
			"serial_outlet":   "OUT-001",
			"password":        "password123",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/device/bind", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("Invalid Credentials", func(t *testing.T) {
		reqBody := map[string]string{
			"serial_business": "BIZ-001",
			"serial_outlet":   "OUT-001",
			"password":        "wrongpassword",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/device/bind", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})
}

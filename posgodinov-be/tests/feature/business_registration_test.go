package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
)

// MockBusinessRepository manual mock untuk feature test tanpa koneksi database nyata
type MockBusinessRepository struct {
	businesses []*domain.Business
}

func (m *MockBusinessRepository) Create(ctx context.Context, b *domain.Business) error {
	m.businesses = append(m.businesses, b)
	return nil
}

func (m *MockBusinessRepository) GetByEmail(ctx context.Context, email string) (*domain.Business, error) {
	return nil, nil
}

func (m *MockBusinessRepository) GetByID(ctx context.Context, id string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.ID == id {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

func (m *MockBusinessRepository) LockByID(ctx context.Context, id string) (*domain.Business, error) {
	return m.GetByID(ctx, id)
}

func (m *MockBusinessRepository) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	return nil, nil
}

func TestFeatureBusinessRegistration(t *testing.T) {
	// 1. Dependency Injection Setup
	repo := &MockBusinessRepository{}
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()
	svc := service.NewBusinessService(repo, tokenMaker, txManager, nil)
	h := handler.NewBusinessHandler(svc)

	// 2. Router Setup
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/business/register", h.Register)

	// 3. Request Preparation
	payload := map[string]string{
		"name":                  "Super Store",
		"owner_name":            "Godinov",
		"email":                 "owner@super.com",
		"password":              "password123",
		"confirmation_password": "password123",
	}
	body, _ := json.Marshal(payload)
	
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/business/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	// 4. Execution
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	// 5. Assertions
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d. body: %s", rr.Code, rr.Body.String())
	}

	var res domain.RegisterBusinessResponse
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.Business.Email != "owner@super.com" {
		t.Errorf("expected email owner@super.com, got %s", res.Business.Email)
	}

	if res.Business.Password != "" {
		t.Errorf("expected password to be hidden, got %s", res.Business.Password)
	}

	if res.AccessToken == "" {
		t.Error("expected PASETO access token to be present")
	}
	if res.RefreshToken == "" {
		t.Error("expected PASETO refresh token to be present")
	}
}

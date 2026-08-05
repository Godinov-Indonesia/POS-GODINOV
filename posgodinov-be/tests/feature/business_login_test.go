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
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
)

// Mock Repo
type MockBusinessLoginRepository struct {
	businesses []*domain.Business
}

func (m *MockBusinessLoginRepository) Create(ctx context.Context, b *domain.Business) error {
	m.businesses = append(m.businesses, b)
	return nil
}

func (m *MockBusinessLoginRepository) GetByEmail(ctx context.Context, email string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.Email == email {
			return b, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockBusinessLoginRepository) GetByID(ctx context.Context, id string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.ID == id {
			return b, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockBusinessLoginRepository) LockByID(ctx context.Context, id string) (*domain.Business, error) {
	return m.GetByID(ctx, id)
}

func (m *MockBusinessLoginRepository) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	return nil, nil
}

func TestFeatureBusinessLogin(t *testing.T) {
	// Setup
	repo := &MockBusinessLoginRepository{}
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()
	svc := service.NewBusinessService(repo, tokenMaker, txManager)
	h := handler.NewBusinessHandler(svc)

	// Seed user
	hashed, _ := bcrypt.GenerateFromPassword([]byte("secret123"), bcrypt.DefaultCost)
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-abc",
		Email:    "login@test.com",
		Password: string(hashed),
	})

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/business/login", h.Login)

	t.Run("Valid Login", func(t *testing.T) {
		payload := map[string]string{
			"email":    "login@test.com",
			"password": "secret123",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/business/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d. body: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("Invalid Password", func(t *testing.T) {
		payload := map[string]string{
			"email":    "login@test.com",
			"password": "wrong",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/business/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})
}

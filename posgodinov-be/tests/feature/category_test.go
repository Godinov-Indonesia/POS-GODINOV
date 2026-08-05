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

type MockFeatureCategoryRepository struct {
	categories []*domain.ProductCategory
}

func (m *MockFeatureCategoryRepository) Create(ctx context.Context, cat *domain.ProductCategory) error {
	m.categories = append(m.categories, cat)
	return nil
}
func (m *MockFeatureCategoryRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.ProductCategory, error) {
	return m.categories, nil
}
func (m *MockFeatureCategoryRepository) GetByID(ctx context.Context, id string) (*domain.ProductCategory, error) {
	for _, c := range m.categories {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, errors.New("not found")
}

func TestFeatureCategory(t *testing.T) {
	catRepo := &MockFeatureCategoryRepository{}
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	
	catSvc := service.NewProductCategoryService(catRepo, outletRepo)
	catHandler := handler.NewProductCategoryHandler(catSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/categories", authMw(catHandler.Create))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Create Category", func(t *testing.T) {
		body := map[string]interface{}{
			"name": "Coffee",
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/categories", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d", rr.Code)
		}
	})
}

func (m *MockFeatureCategoryRepository) CreateBulk(ctx context.Context, categories []*domain.ProductCategory) error {
	return nil
}

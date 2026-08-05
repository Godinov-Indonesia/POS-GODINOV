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

type MockFeatureProductRepository struct {
	products []*domain.Product
}

func (m *MockFeatureProductRepository) CreateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	m.products = append(m.products, product)
	return nil
}

func (m *MockFeatureProductRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Product, error) {
	return m.products, nil
}

func (m *MockFeatureProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	return nil, nil
}
func (m *MockFeatureProductRepository) DeleteProduct(ctx context.Context, id string) error {
	return nil
}
func (m *MockFeatureProductRepository) UpdateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	return nil
}

func TestFeatureProduct(t *testing.T) {
	productRepo := &MockFeatureProductRepository{}
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
	txManager := database.NewMockTransactionManager()
	
	productSvc := service.NewProductService(productRepo, rmRepo, outletRepo, txManager)
	productHandler := handler.NewProductHandler(productSvc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	authMw := middleware.AuthMiddleware(tokenMaker)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/products", authMw(productHandler.Create))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/products", authMw(productHandler.GetAll))

	validToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "b1",
		Email: "test@domain.com",
		Type:  "access",
	}, time.Hour)

	t.Run("Create Product", func(t *testing.T) {
		body := map[string]interface{}{
			"name":  "Es Susu",
			"price": 10000,
			"recipes": []map[string]interface{}{
				{
					"raw_material_id": "rm1",
					"quantity":        200,
				},
			},
		}
		jsonBody, _ := json.Marshal(body)
		
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/o1/products", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("expected 201 Created, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	})
	
	t.Run("Get All Products", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/o1/products", nil)
		req.Header.Set("Authorization", "Bearer "+validToken)

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})
}

func (m *MockFeatureProductRepository) CreateBulkProductsWithRecipes(ctx context.Context, products []*domain.Product) error {
	return nil
}

package unit

import (
	"context"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockProductRepository struct {
	products []*domain.Product
}

func (m *MockProductRepository) CreateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	m.products = append(m.products, product)
	return nil
}

func (m *MockProductRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Product, error) {
	var res []*domain.Product
	for _, p := range m.products {
		if p.OutletID == outletID {
			res = append(res, p)
		}
	}
	return m.products, nil
}

func (m *MockProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	return nil, nil
}
func (m *MockProductRepository) DeleteProduct(ctx context.Context, id string) error {
	return nil
}
func (m *MockProductRepository) UpdateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	return nil
}

func TestProductService(t *testing.T) {
	ctx := context.Background()

	productRepo := &MockProductRepository{}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Susu"},
		},
	}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	txManager := database.NewMockTransactionManager()

	svc := service.NewProductService(productRepo, rmRepo, outletRepo, txManager)

	t.Run("Valid Create Product with Recipes", func(t *testing.T) {
		req := &domain.CreateProductRequest{
			Name:  "Kopi Susu",
			Price: 15000,
			Recipes: []domain.CreateProductRecipeRequest{
				{RawMaterialID: "rm1", Quantity: 50},
			},
		}

		res, err := svc.Create(ctx, "b1", "o1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Name != "Kopi Susu" {
			t.Errorf("expected Kopi Susu, got %s", res.Name)
		}
		if len(res.Recipes) != 1 {
			t.Errorf("expected 1 recipe, got %d", len(res.Recipes))
		}
	})

	t.Run("Create Product with Invalid Raw Material", func(t *testing.T) {
		req := &domain.CreateProductRequest{
			Name:  "Kopi",
			Price: 10000,
			Recipes: []domain.CreateProductRecipeRequest{
				{RawMaterialID: "rm2", Quantity: 50}, // tidak ada di repo
			},
		}

		_, err := svc.Create(ctx, "b1", "o1", req)
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
	
	t.Run("Create Product Duplicate Recipe", func(t *testing.T) {
		req := &domain.CreateProductRequest{
			Name:  "Kopi Double Susu",
			Price: 10000,
			Recipes: []domain.CreateProductRecipeRequest{
				{RawMaterialID: "rm1", Quantity: 50},
				{RawMaterialID: "rm1", Quantity: 50},
			},
		}

		_, err := svc.Create(ctx, "b1", "o1", req)
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

func (m *MockProductRepository) CreateBulkProductsWithRecipes(ctx context.Context, products []*domain.Product) error {
	return nil
}

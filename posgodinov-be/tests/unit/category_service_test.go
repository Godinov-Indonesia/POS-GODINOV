package unit

import (
	"context"
	"errors"
	"testing"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockProductCategoryRepository struct {
	categories []*domain.ProductCategory
}

func (m *MockProductCategoryRepository) Create(ctx context.Context, category *domain.ProductCategory) error {
	m.categories = append(m.categories, category)
	return nil
}

func (m *MockProductCategoryRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.ProductCategory, error) {
	return m.categories, nil
}

func (m *MockProductCategoryRepository) GetByID(ctx context.Context, id string) (*domain.ProductCategory, error) {
	for _, c := range m.categories {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, errors.New("not found")
}

func TestProductCategoryService(t *testing.T) {
	ctx := context.Background()
	catRepo := &MockProductCategoryRepository{}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{{ID: "o1", BusinessID: "b1"}},
	}
	svc := service.NewProductCategoryService(catRepo, outletRepo)

	t.Run("Create Category", func(t *testing.T) {
		req := &domain.CreateProductCategoryRequest{Name: "Minuman"}
		res, err := svc.Create(ctx, "b1", "o1", req)
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if res.Name != "Minuman" {
			t.Errorf("expected Minuman, got %s", res.Name)
		}
	})
}

func (m *MockProductCategoryRepository) CreateBulk(ctx context.Context, categories []*domain.ProductCategory) error {
	return nil
}

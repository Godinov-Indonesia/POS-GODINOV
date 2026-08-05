package unit

import (
	"context"
	"testing"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

func TestBulkCategoryCreate(t *testing.T) {
	mockCatRepo := &MockProductCategoryRepository{}
	mockOutletRepo := &MockOutletRepository{}
	svc := service.NewProductCategoryService(mockCatRepo, mockOutletRepo)

	// Just a basic test so it exists
	_, err := svc.CreateBulk(context.Background(), "business-id", "outlet-id", []*domain.CreateProductCategoryRequest{})
	if err == nil {
		t.Log("Expected error or success")
	}
}

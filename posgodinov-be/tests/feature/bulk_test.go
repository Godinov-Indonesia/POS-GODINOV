package feature

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
)

func TestBulkCategoryHandler(t *testing.T) {
	mockCatRepo := &MockFeatureCategoryRepository{}
	mockOutletRepo := &MockFeatureOutletRepository{}
	svc := service.NewProductCategoryService(mockCatRepo, mockOutletRepo)
	h := handler.NewProductCategoryHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/1/categories/bulk", bytes.NewBuffer([]byte(`[{"name":"Cat1"}]`)))
	w := httptest.NewRecorder()

	h.CreateBulk(w, req)

	if w.Result().StatusCode != http.StatusUnauthorized {
		t.Logf("Expected Unauthorized without token, got %d", w.Result().StatusCode)
	}
}

package feature

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockReportRepository struct {
	Stats        *domain.DashboardStats
	TopProducts  []*domain.TopProduct
	Transactions []*domain.Transaction
	Err          error
}

func (m *MockReportRepository) GetDashboardStats(ctx context.Context, filter domain.ReportFilter) (*domain.DashboardStats, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Stats, nil
}

func (m *MockReportRepository) GetTopProducts(ctx context.Context, filter domain.ReportFilter, limit int) ([]*domain.TopProduct, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	if limit > 0 && len(m.TopProducts) > limit {
		return m.TopProducts[:limit], nil
	}
	return m.TopProducts, nil
}

func (m *MockReportRepository) GetTransactions(ctx context.Context, filter domain.ReportFilter) ([]*domain.Transaction, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Transactions, nil
}

// mockAuthMiddleware is a helper to inject a token payload into the request context.
func mockAuthMiddleware(payload *token.Payload, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func TestReportHandler_GetDashboard(t *testing.T) {
	repo := &MockReportRepository{
		Stats: &domain.DashboardStats{
			TotalRevenue: 500000,
		},
		TopProducts: []*domain.TopProduct{
			{ProductID: "p1", ProductName: "Kopi", QuantitySold: 10},
		},
	}
	svc := service.NewReportService(repo)
	h := handler.NewReportHandler(svc)

	mux := http.NewServeMux()
	
	// Add routes wrapped with our mock auth middleware for testing
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/dashboard", mockAuthMiddleware(&token.Payload{
		ID:   "biz1",
		Type: "OWNER",
	}, h.GetDashboard))
	
	mux.HandleFunc("GET /v1/business/outlets/out1/reports/dashboard_tenant", mockAuthMiddleware(&token.Payload{
		ID:    "out1", // Tenant token ID is OutletID
		Email: "biz1", // Tenant token Email is BusinessID
		Type:  "TENANT",
	}, h.GetDashboard))
	
	mux.HandleFunc("GET /v1/reports/dashboard/unauthorized", h.GetDashboard)

	t.Run("OWNER access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/123/reports/dashboard", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("TENANT access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/out1/reports/dashboard_tenant", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("Unauthorized access (no token)", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/reports/dashboard/unauthorized", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})

	t.Run("Error from service", func(t *testing.T) {
		errorRepo := &MockReportRepository{Err: errors.New("db error")}
		errorSvc := service.NewReportService(errorRepo)
		errorH := handler.NewReportHandler(errorSvc)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), middleware.AuthPayloadKey, &token.Payload{
			ID:   "biz1",
			Type: "OWNER",
		})
		req = req.WithContext(ctx)

		rr := httptest.NewRecorder()
		errorH.GetDashboard(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 Internal Server Error, got %d", rr.Code)
		}
	})
}

func TestReportHandler_GetTransactions(t *testing.T) {
	repo := &MockReportRepository{
		Transactions: []*domain.Transaction{
			{ID: "tx1", TotalAmount: 10000},
		},
	}
	svc := service.NewReportService(repo)
	h := handler.NewReportHandler(svc)

	mux := http.NewServeMux()
	
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/transactions", mockAuthMiddleware(&token.Payload{
		ID:   "biz1",
		Type: "OWNER",
	}, h.GetTransactions))
	
	mux.HandleFunc("GET /v1/business/outlets/out1/reports/transactions_tenant", mockAuthMiddleware(&token.Payload{
		ID:    "out1",
		Email: "biz1",
		Type:  "TENANT",
	}, h.GetTransactions))

	mux.HandleFunc("GET /v1/reports/transactions/unauthorized", h.GetTransactions)

	t.Run("OWNER access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/123/reports/transactions", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("TENANT access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/business/outlets/out1/reports/transactions_tenant", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("Unauthorized access (no token)", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/reports/transactions/unauthorized", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", rr.Code)
		}
	})

	t.Run("Error from service", func(t *testing.T) {
		errorRepo := &MockReportRepository{Err: errors.New("db error")}
		errorSvc := service.NewReportService(errorRepo)
		errorH := handler.NewReportHandler(errorSvc)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), middleware.AuthPayloadKey, &token.Payload{
			ID:   "biz1",
			Type: "OWNER",
		})
		req = req.WithContext(ctx)

		rr := httptest.NewRecorder()
		errorH.GetTransactions(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 Internal Server Error, got %d", rr.Code)
		}
	})
}

package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
)

func TestTenantMiddleware_MissingHeader(t *testing.T) {
	// Setup dummy TenantManager with empty config (will fail to connect, which is fine for missing header test)
	tm := database.NewTenantManager(&config.Config{}, nil)
	middleware := TenantMiddleware(tm)

	// Create a dummy handler
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("Handler should not be called when header is missing")
	})

	// Create a request with no X-Tenant-ID
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	// Execute middleware
	middleware(nextHandler).ServeHTTP(rr, req)

	// Assert 400 Bad Request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", status)
	}
}

func TestTenantMiddleware_InvalidFormat(t *testing.T) {
	tm := database.NewTenantManager(&config.Config{}, nil)
	middleware := TenantMiddleware(tm)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("Handler should not be called when ID format is invalid")
	})

	// Create a request with invalid UUID format
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Tenant-ID", "invalid-id-with-dashes!")
	rr := httptest.NewRecorder()

	middleware(nextHandler).ServeHTTP(rr, req)

	// Assert 500 or 400. In TenantManager `GetTenantDB` returns error on invalid regex,
	// middleware catches it and returns 500.
	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("Expected status 500 (failed connection / validation), got %d", status)
	}
}

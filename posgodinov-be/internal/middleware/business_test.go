package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
)

func TestBusinessMiddleware_MissingHeader(t *testing.T) {
	// Setup dummy BusinessDBManager with empty config (will fail to connect, which is fine for missing header test)
	tm := database.NewBusinessDBManager(&config.Config{}, nil)
	middleware := BusinessMiddleware(tm)

	// Create a dummy handler
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("Handler should not be called when header is missing")
	})

	// Create a request with no X-Business-ID
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	// Execute middleware
	middleware(nextHandler).ServeHTTP(rr, req)

	// Assert 400 Bad Request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", status)
	}
}

func TestBusinessMiddleware_InvalidFormat(t *testing.T) {
	tm := database.NewBusinessDBManager(&config.Config{}, nil)
	middleware := BusinessMiddleware(tm)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("Handler should not be called when ID format is invalid")
	})

	// Create a request with invalid UUID format
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Business-ID", "invalid-id-with-dashes!")
	rr := httptest.NewRecorder()

	middleware(nextHandler).ServeHTTP(rr, req)

	// Assert 500 or 400. In BusinessDBManager `GetTenantDB` returns error on invalid regex,
	// middleware catches it and returns 500.
	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("Expected status 500 (failed connection / validation), got %d", status)
	}
}

func TestBusinessMiddleware_CrossTenantForbidden(t *testing.T) {
	tm := database.NewBusinessDBManager(&config.Config{}, nil)
	mw := BusinessMiddleware(tm)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("Handler should not be called when X-Business-ID mismatches token")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Business-ID", "BIZ_VICTIM")
	ctx := context.WithValue(req.Context(), AuthPayloadKey, &token.Payload{
		ID:   "BIZ_ATTACKER",
		Type: "access",
	})
	rr := httptest.NewRecorder()

	mw(nextHandler).ServeHTTP(rr, req.WithContext(ctx))

	if status := rr.Code; status != http.StatusForbidden {
		t.Errorf("Expected status 403 Forbidden, got %d", status)
	}
}

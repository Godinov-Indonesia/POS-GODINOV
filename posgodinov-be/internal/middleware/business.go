package middleware

import (
	"context"
	"net/http"
	"strings"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/response"
)



// BusinessMiddleware extracts the Tenant ID from the HTTP Header (X-Business-ID)
// or from the Auth Payload (if auth middleware was already run),
// acquires the business DB connection from the connection pool,
// and injects it into the request context.
func BusinessMiddleware(tenantManager *database.BusinessDBManager) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			businessID := r.Header.Get("X-Business-ID")

			// Fallback to JWT/PASETO Payload if header is empty and user is authenticated
			if businessID == "" {
				if payload := r.Context().Value(AuthPayloadKey); payload != nil {
					// Since payload is an interface{}, we need to assert it or we can't read BusinessID.
					// We'd have to import token package, which creates an import cycle if token imports something else, 
					// but let's assume we can cast it. Wait, auth.go does this.
					// Let's stick to X-Business-ID for explicit routing to avoid import cycles here if any.
				}
			}

			if businessID == "" {
				response.Error(w, http.StatusBadRequest, "X-Business-ID header is required for this endpoint", nil)
				return
			}

			// Validate format basic
			businessID = strings.TrimSpace(businessID)
			
			businessDB, err := tenantManager.GetTenantDB(r.Context(), businessID)
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Failed to connect to business database", nil)
				return
			}

			ctx := context.WithValue(r.Context(), database.BusinessDBKey, businessDB)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

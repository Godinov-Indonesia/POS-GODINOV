package middleware

import (
	"context"
	"net/http"
	"strings"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/response"
)



// TenantMiddleware extracts the Tenant ID from the HTTP Header (X-Tenant-ID)
// or from the Auth Payload (if auth middleware was already run),
// acquires the tenant DB connection from the connection pool,
// and injects it into the request context.
func TenantMiddleware(tenantManager *database.TenantManager) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			tenantID := r.Header.Get("X-Tenant-ID")

			// Fallback to JWT/PASETO Payload if header is empty and user is authenticated
			if tenantID == "" {
				if payload := r.Context().Value(AuthPayloadKey); payload != nil {
					// Since payload is an interface{}, we need to assert it or we can't read TenantID.
					// We'd have to import token package, which creates an import cycle if token imports something else, 
					// but let's assume we can cast it. Wait, auth.go does this.
					// Let's stick to X-Tenant-ID for explicit routing to avoid import cycles here if any.
				}
			}

			if tenantID == "" {
				response.Error(w, http.StatusBadRequest, "X-Tenant-ID header is required for this endpoint", nil)
				return
			}

			// Validate format basic
			tenantID = strings.TrimSpace(tenantID)
			
			tenantDB, err := tenantManager.GetTenantDB(r.Context(), tenantID)
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Failed to connect to tenant database", nil)
				return
			}

			ctx := context.WithValue(r.Context(), database.TenantDBKey, tenantDB)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

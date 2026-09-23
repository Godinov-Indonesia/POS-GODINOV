package middleware

import (
	"context"
	"net/http"
	"strings"

	"gorm.io/gorm"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

// BusinessMiddleware extracts the Tenant ID from the HTTP Header (X-Business-ID)
// or from the Auth Payload (if auth middleware was already run),
// acquires the business DB connection from the connection pool,
// and injects it into the request context.
func BusinessMiddleware(businessManager *database.BusinessDBManager) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			businessID := r.Header.Get("X-Business-ID")

			// Coba ambil payload dari context jika ada
			var payload *token.Payload
			if p := r.Context().Value(AuthPayloadKey); p != nil {
				payload, _ = p.(*token.Payload)
			}

			// Fallback to JWT/PASETO Payload if header is empty and user is authenticated
			if businessID == "" && payload != nil {
				if payload.Type == "device" {
					businessID = payload.Email // For device, businessID is in Email field
				}
			}

			if businessID == "" {
				response.Error(w, http.StatusBadRequest, "X-Business-ID header is required for this endpoint", nil)
				return
			}

			// Validate format basic
			businessID = strings.TrimSpace(businessID)
			
			businessDB, err := businessManager.GetBusinessDB(r.Context(), businessID)
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Failed to connect to business database", nil)
				return
			}

			// Terapkan RLS (Row-Level Security) jika request berasal dari device (POS/Gudang)
			if payload != nil && payload.Type == "device" {
				// Gunakan Transaction agar SET LOCAL aman dan tidak bocor ke koneksi lain di pool
				businessDB.Transaction(func(tx *gorm.DB) error {
					tx.Exec("SET LOCAL app.current_outlet_id = ?", payload.ID)
					ctx := context.WithValue(r.Context(), database.BusinessDBKey, tx)
					next.ServeHTTP(w, r.WithContext(ctx))
					return nil
				})
				return
			}

			ctx := context.WithValue(r.Context(), database.BusinessDBKey, businessDB)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

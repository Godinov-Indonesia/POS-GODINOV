package middleware

import (
	"context"
	"net/http"
	"strings"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

// BusinessMiddleware extracts the Tenant ID from the Auth Payload (or X-Business-ID header),
// verifies tenant isolation, acquires the business DB connection from the connection pool,
// and injects it into the request context.
func BusinessMiddleware(businessManager *database.BusinessDBManager, policyEngines ...domain.PolicyEngine) func(http.HandlerFunc) http.HandlerFunc {
	var pe domain.PolicyEngine
	if len(policyEngines) > 0 {
		pe = policyEngines[0]
	}

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			businessID := strings.TrimSpace(r.Header.Get("X-Business-ID"))

			// Coba ambil payload dari context jika ada
			var payload *token.Payload
			if p := r.Context().Value(AuthPayloadKey); p != nil {
				payload, _ = p.(*token.Payload)
			}

			if payload != nil {
				tokenBizID := strings.TrimSpace(payload.ID)
				if payload.Type == "device" {
					tokenBizID = strings.TrimSpace(payload.Email)
				}
				if tokenBizID != "" {
					if businessID != "" && businessID != tokenBizID {
						response.Error(w, http.StatusForbidden, "Akses ditolak: X-Business-ID tidak sesuai dengan token aktif", nil)
						return
					}
					businessID = tokenBizID
				}
			}

			if businessID == "" {
				response.Error(w, http.StatusBadRequest, "X-Business-ID header is required for this endpoint", nil)
				return
			}

			if pe != nil && (payload == nil || !payload.IsImpersonated) {
				if policy, pErr := pe.GetEffectivePolicy(r.Context(), businessID); pErr == nil && policy != nil && policy.Status == "SUSPENDED" {
					response.Error(w, http.StatusForbidden, "Akun bisnis Anda ditangguhkan (SUSPENDED), silakan hubungi customer support", nil)
					return
				}
			}

			businessDB, err := businessManager.GetBusinessDB(r.Context(), businessID)
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Failed to connect to business database", nil)
				return
			}

			ctx := context.WithValue(r.Context(), database.BusinessDBKey, businessDB)
			if payload != nil && payload.Type == "device" {
				ctx = context.WithValue(ctx, database.OutletIDKey, payload.ID)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

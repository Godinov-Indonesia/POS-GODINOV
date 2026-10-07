package middleware

import (
	"context"
	"net/http"
	"strings"

	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

const (
	LandlordPayloadKey contextKey = "landlord_payload"
)

// LandlordAuthMiddleware memvalidasi token ber-tipe "landlord" khusus Superadmin / CS Internal
func LandlordAuthMiddleware(tokenMaker token.TokenMaker) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Authorization header diperlukan", nil)
				return
			}

			fields := strings.Fields(authHeader)
			if len(fields) < 2 || strings.ToLower(fields[0]) != "bearer" {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Format Authorization harus 'Bearer <token>'", nil)
				return
			}

			accessToken := fields[1]
			payload, err := tokenMaker.VerifyToken(accessToken)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Token tidak valid atau sudah kedaluwarsa", nil)
				return
			}

			if payload.Type != "landlord" {
				response.Error(w, http.StatusForbidden, "Akses ditolak: Token tidak memiliki wewenang platform landlord", nil)
				return
			}

			ctx := context.WithValue(r.Context(), LandlordPayloadKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

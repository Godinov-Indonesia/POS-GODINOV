package middleware

import (
	"context"
	"net/http"
	"strings"

	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type contextKey string

const (
	AuthPayloadKey contextKey = "auth_payload"
)

func AuthMiddleware(tokenMaker token.TokenMaker) func(http.HandlerFunc) http.HandlerFunc {
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

			if payload.Type != "access" {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Jenis token tidak valid untuk autentikasi", nil)
				return
			}

			// Masukkan payload ke dalam context
			ctx := context.WithValue(r.Context(), AuthPayloadKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

func POSDeviceMiddleware(tokenMaker token.TokenMaker) func(http.HandlerFunc) http.HandlerFunc {
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

			if payload.Type != "device" {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Jenis token tidak valid untuk perangkat POS", nil)
				return
			}

			// Masukkan payload ke dalam context
			ctx := context.WithValue(r.Context(), AuthPayloadKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

// RequireDeviceScope menolak perangkat yang scope-nya bukan [want] — butir 4
// ([11 §M16.1]).
//
// ═══════════════════════════════════════════════════════════════════════════
// PEMISAHAN TUGAS YANG DITEGAKKAN TRANSPORT, BUKAN UI
// ═══════════════════════════════════════════════════════════════════════════
//
// Petugas gudang tidak boleh menyentuh jalur kasir, dan kasir tidak boleh
// menyentuh opname. Menyembunyikan tombolnya saja tidak cukup: siapa pun yang
// memegang device token dapat memanggil endpoint-nya dengan `curl`.
//
// Dipasang SETELAH [POSDeviceMiddleware] — ia membaca payload yang ditaruh
// middleware itu ke context. Dipasang sendirian, `payload` tidak akan pernah
// ada dan seluruh permintaan ditolak; itu keliru ke arah yang aman, tetapi
// tetap salah.
func RequireDeviceScope(want string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			payload, ok := r.Context().Value(AuthPayloadKey).(*token.Payload)
			if !ok {
				response.Error(w, http.StatusUnauthorized, "Akses ditolak: Token tidak valid", nil)
				return
			}

			if payload.EffectiveScope() != want {
				// 403, BUKAN 401. Tokennya sah — yang tidak sah adalah
				// perangkat ini menyentuh jalur ini. Menjawab 401 akan membuat
				// klien mencoba binding ulang, yang tidak akan pernah menolong.
				response.Error(w, http.StatusForbidden,
					"Akses ditolak: perangkat ini tidak berwenang pada jalur tersebut",
					map[string]string{
						"code":  "SCOPE_FORBIDDEN",
						"scope": payload.EffectiveScope(),
					})
				return
			}

			next.ServeHTTP(w, r)
		}
	}
}

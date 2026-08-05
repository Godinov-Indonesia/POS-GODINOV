package middleware

import (
	"net/http"
	"strings"

	"github.com/rs/cors"
)

// SecurityHeaders adds basic security headers to every response
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Proteksi dari clickjacking
		w.Header().Set("X-Frame-Options", "DENY")
		// Mencegah browser menebak MIME type (sniffing)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// Proteksi XSS pada beberapa browser lama
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		// Strict Transport Security (HSTS)
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// Content Security Policy
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		
		next.ServeHTTP(w, r)
	})
}

// SetupCORS returns a standard CORS handler wrapper
func SetupCORS(appEnv string, allowedOrigins string) *cors.Cors {
	origins := []string{"*"}
	if appEnv == "production" {
		// Di mode production, hanya izinkan domain yang secara eksplisit didaftarkan
		origins = strings.Split(allowedOrigins, ",")
	}

	return cors.New(cors.Options{
		AllowedOrigins: origins,
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-CSRF-Token",
		},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Preflight request cache for 5 minutes
	})
}

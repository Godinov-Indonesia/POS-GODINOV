package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"posgodinov-backend/pkg/logger"
)

// PanicRecovery menangkap panic agar aplikasi tidak mati mendadak (crash).
// Jika env adalah production, kita menyembunyikan detail stack-trace dari client.
func PanicRecovery(appEnv string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// Selalu log stack trace di backend
					logger.Error("panic recovered", "error", err, "stack", string(debug.Stack()))
					
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					
					if appEnv == "local" || appEnv == "development" {
						// Berikan detail error ke frontend jika sedang di lokal (mudah untuk debug)
						w.Write([]byte(fmt.Sprintf(`{"error": "Internal Server Error", "details": "%v"}`, err)))
					} else {
						// Sembunyikan detail dari end-user jika di production demi keamanan
						w.Write([]byte(`{"error": "Internal Server Error"}`))
					}
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

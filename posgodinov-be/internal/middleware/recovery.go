package middleware

import (
	"encoding/json"
	"net/http"
	"runtime/debug"

	"posgodinov-backend/pkg/logger"
)

type errorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// PanicRecovery menangkap panic agar aplikasi tidak mati mendadak (crash).
func PanicRecovery(appEnv string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// 1. Selalu log stack trace di backend
					logger.Error("panic recovered", "error", err, "stack", string(debug.Stack()))

					// 2. Format response error menggunakan JSON Marshal (Aman dari unescaped quote/newline)
					resp := errorResponse{
						Error: "Internal Server Error",
					}

					if appEnv == "local" || appEnv == "development" {
						resp.Details = StringifyError(err)
					}

					jsonBody, _ := json.Marshal(resp)

					// 3. SET HEADER TERLEBIH DAHULU sebelum WriteHeader
					w.Header().Set("Content-Type", "application/json")
					
					// 4. Tulis HTTP Status Code
					w.WriteHeader(http.StatusInternalServerError)
					
					// 5. Tulis Body
					w.Write(jsonBody)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Helper untuk mengubah error interface{} menjadi string yang aman
func StringifyError(err interface{}) string {
	if e, ok := err.(error); ok {
		return e.Error()
	}
	return jsonStringify(err)
}

func jsonStringify(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	default:
		return "panic value: non-string/non-error"
	}
}
package middleware

import (
	"encoding/json"
	"fmt"
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
					logger.Error("panic recovered", "error", err, "stack", string(debug.Stack()))

					resp := errorResponse{Error: "Internal Server Error"}
					if appEnv == "local" || appEnv == "development" {
						resp.Details = fmt.Sprint(err)
					}

					jsonBody, _ := json.Marshal(resp)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					w.Write(jsonBody)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
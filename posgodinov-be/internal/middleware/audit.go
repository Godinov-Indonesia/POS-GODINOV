package middleware

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/token"
)

type responseWriterInterceptor struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriterInterceptor) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func AuditMiddleware(repo domain.AuditRepository) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Get IP Address
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
			userAgent := r.Header.Get("User-Agent")

			// Clone the body so we can log it without destroying it for the handler
			var bodyBytes []byte
			if r.Body != nil {
				bodyBytes, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}

			// Intercept the response to get the status code
			rw := &responseWriterInterceptor{
				ResponseWriter: w,
				statusCode:     http.StatusOK, // Default if WriteHeader is not called
			}

			// Pass to the next handler
			next(rw, r)

			// We only care about logging POST, PUT, DELETE, PATCH actions for audit (mutations)
			// But for strict auditing, maybe we log GET as well? The user said "semua activity".
			// But let's log everything that is authenticated.

			// Check if actor is available from context
			payload, ok := r.Context().Value(AuthPayloadKey).(*token.Payload)
			
			// Only audit logged-in users actions
			if ok && payload != nil {
				// Clean up the body for JSON storage (remove passwords etc if needed, but for simplicity we store raw or sanitized)
				// For safety, let's just convert it to string. If it's too large or not json, handle it gracefully.
				details := "{}"
				if len(bodyBytes) > 0 {
					// Basic check to see if it's JSON (Object or Array)
					bodyStr := strings.TrimSpace(string(bodyBytes))
					if strings.HasPrefix(bodyStr, "{") || strings.HasPrefix(bodyStr, "[") {
						details = string(bodyBytes)
					}
				}

				// Determine action name based on route/method (e.g., "Create Outlet", etc)
				// Or simply store the method + path
				actionName := r.Method + " " + r.URL.Path

				actorType := "BUSINESS"
				if payload.Type == "staff" { // assuming we have a staff payload type later
					actorType = "STAFF"
				}

				auditLog := &domain.AuditLog{
					ActorID:    payload.ID,
					ActorType:  actorType,
					Action:     actionName,
					Method:     r.Method,
					Path:       r.URL.Path,
					Details:    details,
					IPAddress:  ip,
					UserAgent:  userAgent,
					StatusCode: rw.statusCode,
				}

				// Run asynchronously to not block the response
				go func(log *domain.AuditLog) {
					// Use a background context because the request context is canceled after response is sent
					if err := repo.Create(context.Background(), log); err != nil {
						logger.Error("failed to create audit log", "error", err, "action", log.Action)
					}
				}(auditLog)
			}
		}
	}
}

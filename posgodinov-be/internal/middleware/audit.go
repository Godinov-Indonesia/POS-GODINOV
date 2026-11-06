package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/token"
)

func sanitizeAuditJSON(raw []byte) string {
	if len(raw) == 0 {
		return "{}"
	}
	if len(raw) > 4096 {
		return `{"truncated":true}`
	}
	str := strings.TrimSpace(string(raw))
	if !strings.HasPrefix(str, "{") && !strings.HasPrefix(str, "[") {
		return "{}"
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err == nil {
		for _, k := range []string{"password", "new_password", "confirmation_password", "pin", "pin_hash"} {
			if _, exists := obj[k]; exists {
				obj[k] = "[REDACTED]"
			}
		}
		if b, err := json.Marshal(obj); err == nil {
			return string(b)
		}
	}
	return str
}

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

			// Clone the body (capped at 1 MB) so we can log it without destroying it for the handler
			var bodyBytes []byte
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
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

			// Check if actor is available from context
			payload, ok := r.Context().Value(AuthPayloadKey).(*token.Payload)

			// Only audit logged-in users actions
			if ok && payload != nil {
				details := sanitizeAuditJSON(bodyBytes)

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

				// Tangkap Business DB untuk dilempar ke goroutine
				var businessDB interface{}
				if tdb := r.Context().Value(database.BusinessDBKey); tdb != nil {
					businessDB = tdb
				}

				// Run asynchronously to not block the response
				go func(log *domain.AuditLog, tdb interface{}) {
					// Use a background context because the request context is canceled after response is sent
					bgCtx := context.Background()
					if tdb != nil {
						bgCtx = context.WithValue(bgCtx, database.BusinessDBKey, tdb)
					}
					
					if err := repo.Create(bgCtx, log); err != nil {
						logger.Error("failed to create audit log", "error", err, "action", log.Action)
					}
				}(auditLog, businessDB)
			}
		}
	}
}

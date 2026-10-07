package response

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type ErrorResponse struct {
	Status  string            `json:"status"`
	Message string            `json:"message"`
	Errors  map[string]string `json:"errors,omitempty"`
}

// Error formats and writes a standardized error JSON response.
func Error(w http.ResponseWriter, statusCode int, message string, errors map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	status := "error"
	// Sesuai konvensi JSend / standard: 4xx = fail, 5xx = error
	if statusCode >= 400 && statusCode < 500 {
		status = "fail"
	}

	res := ErrorResponse{
		Status:  status,
		Message: message,
		Errors:  errors,
	}

	json.NewEncoder(w).Encode(res)
}

// QuotaExceeded writes a 403 PLAN_LIMIT_EXCEEDED response
func QuotaExceeded(w http.ResponseWriter, featureKey string, currentUsage, limitValue int64) {
	Error(w, http.StatusForbidden, "Batas kuota paket Anda telah tercapai", map[string]string{
		"code":          "PLAN_LIMIT_EXCEEDED",
		"feature_key":   featureKey,
		"current_usage": fmt.Sprintf("%d", currentUsage),
		"limit_value":   fmt.Sprintf("%d", limitValue),
		"upgrade_url":   "/upgrade?feature=" + featureKey,
	})
}

type SuccessResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func Success(w http.ResponseWriter, statusCode int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	})
}

package response

import (
	"encoding/json"
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

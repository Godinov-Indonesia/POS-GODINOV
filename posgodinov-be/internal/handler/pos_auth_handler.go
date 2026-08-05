package handler

import (
	"encoding/json"
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/response"
)

type POSAuthHandler struct {
	service domain.POSAuthService
}

func NewPOSAuthHandler(service domain.POSAuthService) *POSAuthHandler {
	return &POSAuthHandler{service: service}
}

func (h *POSAuthHandler) BindDevice(w http.ResponseWriter, r *http.Request) {
	var req domain.DeviceBindRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", map[string]string{"error": err.Error()})
		return
	}

	if req.SerialBusiness == "" || req.SerialOutlet == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "Serial business, serial outlet, dan password wajib diisi", nil)
		return
	}

	res, err := h.service.BindDevice(r.Context(), &req)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Device berhasil diikat dengan outlet", res)
}

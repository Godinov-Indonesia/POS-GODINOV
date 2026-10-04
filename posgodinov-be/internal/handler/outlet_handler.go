package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type OutletHandler struct {
	svc domain.OutletService
}

func NewOutletHandler(svc domain.OutletService) *OutletHandler {
	return &OutletHandler{svc: svc}
}

func (h *OutletHandler) Register(w http.ResponseWriter, r *http.Request) {
	// 1. Ekstrak bisnis ID dari Token Auth
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		logger.Error("payload tidak ditemukan di context")
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	// 2. Baca Body
	var req domain.CreateOutletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	// 3. Panggil Service, lempar Business ID dari Token!
	outlet, err := h.svc.Register(r.Context(), payload.ID, &req)
	if err != nil {
		logger.Error("gagal mendaftarkan outlet", "error", err)
		var quotaErr *service.QuotaExceededError
		if errors.As(err, &quotaErr) {
			response.QuotaExceeded(w, quotaErr.FeatureKey, quotaErr.CurrentUsage, quotaErr.LimitValue)
			return
		}
		if strings.Contains(err.Error(), "SUSPENDED") {
			response.Error(w, http.StatusForbidden, err.Error(), nil)
			return
		}
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, "Gagal mendaftarkan outlet", errs)
		return
	}

	// 4. Return Berhasil
	logger.Info("outlet berhasil didaftarkan", "id", outlet.ID, "business_id", payload.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Outlet berhasil didaftarkan",
		"data":    outlet,
	})
}

func (h *OutletHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		logger.Error("payload tidak ditemukan di context")
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outlets, err := h.svc.GetAll(r.Context(), payload.ID)
	if err != nil {
		logger.Error("gagal mengambil daftar outlet", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil daftar outlet", errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Berhasil mengambil daftar outlet",
		"data":    outlets,
	})
}

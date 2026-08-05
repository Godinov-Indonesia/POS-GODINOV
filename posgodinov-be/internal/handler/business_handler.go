package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
)

type BusinessHandler struct {
	svc domain.BusinessService
}

func NewBusinessHandler(svc domain.BusinessService) *BusinessHandler {
	return &BusinessHandler{svc: svc}
}

func (h *BusinessHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req domain.RegisterBusinessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.Register(r.Context(), &req)
	if err != nil {
		logger.Error("gagal mendaftarkan bisnis", "error", err)
		
		errs := make(map[string]string)
		if strings.Contains(err.Error(), "password") {
			errs["password"] = err.Error()
		} else {
			errs["server"] = err.Error()
		}

		response.Error(w, http.StatusBadRequest, "Gagal mendaftarkan bisnis", errs)
		return
	}

	logger.Info("bisnis berhasil didaftarkan", "id", res.Business.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(res)
}

func (h *BusinessHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginBusinessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.Login(r.Context(), &req)
	if err != nil {
		logger.Error("gagal login bisnis", "error", err)

		errs := make(map[string]string)
		if strings.Contains(err.Error(), "email atau password salah") {
			errs["credentials"] = err.Error()
			response.Error(w, http.StatusUnauthorized, "Gagal login", errs)
			return
		}

		errs["server"] = err.Error()
		response.Error(w, http.StatusInternalServerError, "Gagal login", errs)
		return
	}

	logger.Info("bisnis berhasil login", "id", res.Business.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

func (h *BusinessHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req domain.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.RefreshToken(r.Context(), &req)
	if err != nil {
		logger.Error("gagal melakukan refresh token", "error", err)
		
		errs := make(map[string]string)
		errs["token"] = err.Error()
		response.Error(w, http.StatusUnauthorized, "Gagal memperbarui token", errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

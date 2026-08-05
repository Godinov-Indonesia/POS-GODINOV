package handler

import (
	"encoding/json"
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type StaffHandler struct {
	svc domain.StaffService
}

func NewStaffHandler(svc domain.StaffService) *StaffHandler {
	return &StaffHandler{svc: svc}
}

func (h *StaffHandler) RegisterStaff(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		logger.Error("payload tidak ditemukan di context")
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	var req domain.CreateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	staff, err := h.svc.RegisterStaff(r.Context(), payload.ID, &req)
	if err != nil {
		logger.Error("gagal mendaftarkan kasir", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	logger.Info("kasir berhasil didaftarkan", "id", staff.ID, "outlet_id", staff.OutletID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Staff berhasil didaftarkan",
		"data":    staff,
	})
}

func (h *StaffHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outletID := r.PathValue("outlet_id")
	if outletID == "" {
		response.Error(w, http.StatusBadRequest, "ID outlet tidak valid", nil)
		return
	}

	staffs, err := h.svc.GetAllByOutlet(r.Context(), payload.ID, outletID)
	if err != nil {
		logger.Error("gagal mendapatkan daftar staff", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Daftar staff berhasil didapatkan",
		"data":    staffs,
	})
}

func (h *StaffHandler) GetAllByBusiness(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	staffs, err := h.svc.GetAllByBusiness(r.Context(), payload.ID)
	if err != nil {
		logger.Error("gagal mendapatkan daftar semua staff bisnis", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Daftar semua staff bisnis berhasil didapatkan",
		"data":    staffs,
	})
}

func (h *StaffHandler) Update(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	staffID := r.PathValue("staff_id")
	if staffID == "" {
		response.Error(w, http.StatusBadRequest, "ID staff tidak valid", nil)
		return
	}

	var req domain.UpdateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	staff, err := h.svc.UpdateStaff(r.Context(), payload.ID, staffID, &req)
	if err != nil {
		logger.Error("gagal mengupdate staff", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Staff berhasil diupdate",
		"data":    staff,
	})
}

func (h *StaffHandler) Delete(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	staffID := r.PathValue("staff_id")
	if staffID == "" {
		response.Error(w, http.StatusBadRequest, "ID staff tidak valid", nil)
		return
	}

	err := h.svc.DeleteStaff(r.Context(), payload.ID, staffID)
	if err != nil {
		logger.Error("gagal menghapus staff", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Staff berhasil dihapus",
	})
}

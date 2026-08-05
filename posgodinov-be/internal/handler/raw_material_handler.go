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

type RawMaterialHandler struct {
	svc domain.RawMaterialService
}

func NewRawMaterialHandler(svc domain.RawMaterialService) *RawMaterialHandler {
	return &RawMaterialHandler{svc: svc}
}

func (h *RawMaterialHandler) Create(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outletID := r.PathValue("outlet_id")
	if outletID == "" {
		response.Error(w, http.StatusBadRequest, "Outlet ID tidak valid", nil)
		return
	}

	var req domain.CreateRawMaterialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	rm, err := h.svc.Create(r.Context(), payload.ID, outletID, &req)
	if err != nil {
		logger.Error("gagal membuat bahan baku", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Bahan baku berhasil ditambahkan",
		"data":    rm,
	})
}

func (h *RawMaterialHandler) CreateBulk(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outletID := r.PathValue("outlet_id")
	if outletID == "" {
		response.Error(w, http.StatusBadRequest, "Outlet ID tidak valid", nil)
		return
	}

	var reqs []*domain.CreateRawMaterialRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	rawMaterials, err := h.svc.CreateBulk(r.Context(), payload.ID, outletID, reqs)
	if err != nil {
		logger.Error("gagal membuat bahan baku bulk", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Bahan baku berhasil ditambahkan secara massal",
		"data":    rawMaterials,
	})
}

func (h *RawMaterialHandler) Update(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	rmID := r.PathValue("raw_material_id")
	if rmID == "" {
		response.Error(w, http.StatusBadRequest, "ID bahan baku tidak valid", nil)
		return
	}

	var req domain.UpdateRawMaterialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	rm, err := h.svc.Update(r.Context(), payload.ID, rmID, &req)
	if err != nil {
		logger.Error("gagal mengupdate bahan baku", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Bahan baku berhasil diupdate",
		"data":    rm,
	})
}

func (h *RawMaterialHandler) Delete(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	rmID := r.PathValue("raw_material_id")
	if rmID == "" {
		response.Error(w, http.StatusBadRequest, "ID bahan baku tidak valid", nil)
		return
	}

	err := h.svc.Delete(r.Context(), payload.ID, rmID)
	if err != nil {
		logger.Error("gagal menghapus bahan baku", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Bahan baku berhasil dihapus",
	})
}

func (h *RawMaterialHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outletID := r.PathValue("outlet_id")
	if outletID == "" {
		response.Error(w, http.StatusBadRequest, "Outlet ID tidak valid", nil)
		return
	}

	rms, err := h.svc.GetAllByOutlet(r.Context(), payload.ID, outletID)
	if err != nil {
		logger.Error("gagal mengambil bahan baku", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Berhasil mengambil data bahan baku",
		"data":    rms,
	})
}

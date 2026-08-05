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

type WasteLogHandler struct {
	svc domain.WasteLogService
}

func NewWasteLogHandler(svc domain.WasteLogService) *WasteLogHandler {
	return &WasteLogHandler{svc: svc}
}

func (h *WasteLogHandler) Record(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	outletID := r.PathValue("outlet_id")
	rawMaterialID := r.PathValue("raw_material_id")
	if outletID == "" || rawMaterialID == "" {
		response.Error(w, http.StatusBadRequest, "ID tidak valid", nil)
		return
	}

	var req domain.CreateWasteLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	log, err := h.svc.RecordWaste(r.Context(), payload.ID, outletID, rawMaterialID, payload.ID, &req)
	if err != nil {
		logger.Error("gagal mencatat waste", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Waste log berhasil dicatat",
		"data":    log,
	})
}

func (h *WasteLogHandler) RecordBulk(w http.ResponseWriter, r *http.Request) {
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

	var reqs []*domain.CreateBulkWasteLogRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", nil)
		return
	}

	logs, err := h.svc.RecordBulkWaste(r.Context(), payload.ID, outletID, payload.ID, reqs)
	if err != nil {
		logger.Error("gagal mencatat bulk waste", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Waste massal berhasil dicatat",
		"data":    logs,
	})
}

func (h *WasteLogHandler) GetAll(w http.ResponseWriter, r *http.Request) {
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

	logs, err := h.svc.GetAllByOutlet(r.Context(), payload.ID, outletID)
	if err != nil {
		logger.Error("gagal mengambil laporan waste", "error", err)
		errs := make(map[string]string)
		errs["server"] = err.Error()
		response.Error(w, http.StatusBadRequest, err.Error(), errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Laporan waste berhasil diambil",
		"data":    logs,
	})
}

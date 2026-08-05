package handler

import (
	"encoding/json"
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type POSSyncHandler struct {
	service domain.POSSyncService
}

func NewPOSSyncHandler(service domain.POSSyncService) *POSSyncHandler {
	return &POSSyncHandler{service: service}
}

func (h *POSSyncHandler) GetMasterData(w http.ResponseWriter, r *http.Request) {
	// Middleware harus meletakkan Payload di context
	// Untuk role DEVICE, Payload.Email adalah BusinessID dan Payload.ID adalah OutletID
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token payload tidak ditemukan", nil)
		return
	}

	businessID := payload.Email
	outletID := payload.ID

	if businessID == "" || outletID == "" {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	res, err := h.service.GetMasterData(r.Context(), businessID, outletID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Master data berhasil disinkronisasi", res)
}

func (h *POSSyncHandler) SyncUp(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token payload tidak ditemukan", nil)
		return
	}

	businessID := payload.Email
	outletID := payload.ID

	if businessID == "" || outletID == "" {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	var req domain.SyncUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format payload tidak valid", map[string]string{"error": err.Error()})
		return
	}

	res, err := h.service.SyncUp(r.Context(), businessID, outletID, &req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Proses sinkronisasi transaksi selesai", res)
}

func (h *POSSyncHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token payload tidak ditemukan", nil)
		return
	}

	outletID := payload.ID
	if outletID == "" {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	limit := 50
	offset := 0
	
	// Optional: parse limit and offset from query params
	// if l := r.URL.Query().Get("limit"); l != "" { ... }
	// if o := r.URL.Query().Get("offset"); o != "" { ... }

	res, err := h.service.GetTransactions(r.Context(), outletID, limit, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Riwayat transaksi berhasil didapatkan", res)
}

package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type UploadHandler struct {
	svc domain.UploadService
}

func NewUploadHandler(svc domain.UploadService) *UploadHandler {
	return &UploadHandler{svc: svc}
}

// GetUploadSignature menghasilkan signature lisensi Cloudinary Signed Upload
// dengan folder dinamis multi-tenant (posgodinov/{business_id}/{purpose}).
func (h *UploadHandler) GetUploadSignature(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	businessID := payload.ID
	if businessID == "" && payload.BusinessID != "" {
		businessID = payload.BusinessID
	}

	purpose := domain.UploadPurposeProduct
	// Jika terdapat request body JSON, baca field purpose opsional
	if r.Body != nil && r.ContentLength > 0 {
		var req domain.CreateUploadSignatureRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Purpose != "" {
			purpose = req.Purpose
		}
	}

	sig, err := h.svc.GenerateUploadSignature(r.Context(), businessID, purpose)
	if err != nil {
		if errors.Is(err, service.ErrCloudinaryNotConfigured) {
			response.Error(w, http.StatusServiceUnavailable, err.Error(), nil)
			return
		}
		logger.Error("Gagal generate signature upload", "error", err)
		response.Error(w, http.StatusInternalServerError, "Gagal membuat signature upload", nil)
		return
	}

	response.Success(w, http.StatusOK, "Signature upload berhasil dibuat", sig)
}

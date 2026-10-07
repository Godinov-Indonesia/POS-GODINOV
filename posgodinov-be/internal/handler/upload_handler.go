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

	var req domain.CreateUploadSignatureRequest
	req.Purpose = domain.UploadPurposeProduct

	// Jika terdapat request body JSON, baca field purpose & outlet_id
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Purpose == "" {
			req.Purpose = domain.UploadPurposeProduct
		}
	}

	sig, err := h.svc.GenerateUploadSignature(r.Context(), businessID, &req)
	if err != nil {
		if errors.Is(err, service.ErrCloudinaryNotConfigured) {
			response.Error(w, http.StatusServiceUnavailable, err.Error(), nil)
			return
		}
		var quotaErr *service.QuotaExceededError
		if errors.As(err, &quotaErr) {
			response.QuotaExceeded(w, quotaErr.FeatureKey, quotaErr.CurrentUsage, quotaErr.LimitValue)
			return
		}
		logger.Error("Gagal generate signature upload", "error", err)
		response.Error(w, http.StatusInternalServerError, "Gagal membuat signature upload", nil)
		return
	}

	response.Success(w, http.StatusOK, "Signature upload berhasil dibuat", sig)
}

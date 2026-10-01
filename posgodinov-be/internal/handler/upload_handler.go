package handler

import (
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

// GetProductImageSignature menghasilkan signature lisensi Cloudinary Signed Upload
// agar klien browser dapat mengunggah file gambar produk langsung ke Cloudinary.
func (h *UploadHandler) GetProductImageSignature(w http.ResponseWriter, r *http.Request) {
	_, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak ada akses", nil)
		return
	}

	sig, err := h.svc.GenerateProductImageSignature(r.Context())
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

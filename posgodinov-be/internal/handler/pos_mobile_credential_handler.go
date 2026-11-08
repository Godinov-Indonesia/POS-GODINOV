package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type POSMobileCredentialHandler struct {
	svc domain.POSMobileCredentialService
}

func NewPOSMobileCredentialHandler(svc domain.POSMobileCredentialService) *POSMobileCredentialHandler {
	return &POSMobileCredentialHandler{svc: svc}
}

func (h *POSMobileCredentialHandler) List(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	var isActive *bool
	if activeStr := r.URL.Query().Get("is_active"); activeStr != "" {
		val := activeStr == "true" || activeStr == "1"
		isActive = &val
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	list, total, err := h.svc.List(r.Context(), search, isActive, page, limit)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	meta := map[string]any{
		"page":  page,
		"limit": limit,
		"total": total,
	}
	response.SuccessWithMeta(w, http.StatusOK, "Daftar kredensial pos mobile berhasil diambil", list, meta)
}

func (h *POSMobileCredentialHandler) Create(w http.ResponseWriter, r *http.Request) {
	adminID := ""
	if payload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload); ok && payload != nil {
		adminID = payload.ID
	}

	var req domain.CreatePOSMobileCredentialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid: format JSON salah", nil)
		return
	}

	cred, err := h.svc.Create(r.Context(), adminID, &req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusCreated, "Kredensial POS mobile berhasil dibuat", cred)
}

func (h *POSMobileCredentialHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID kredensial tidak boleh kosong", nil)
		return
	}

	cred, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Detail kredensial POS mobile berhasil diambil", cred)
}

func (h *POSMobileCredentialHandler) Update(w http.ResponseWriter, r *http.Request) {
	adminID := ""
	if payload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload); ok && payload != nil {
		adminID = payload.ID
	}

	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID kredensial tidak boleh kosong", nil)
		return
	}

	var req domain.UpdatePOSMobileCredentialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid: format JSON salah", nil)
		return
	}

	cred, err := h.svc.Update(r.Context(), adminID, id, &req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Kredensial POS mobile berhasil diperbarui", cred)
}

func (h *POSMobileCredentialHandler) Delete(w http.ResponseWriter, r *http.Request) {
	adminID := ""
	if payload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload); ok && payload != nil {
		adminID = payload.ID
	}

	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID kredensial tidak boleh kosong", nil)
		return
	}

	if err := h.svc.Delete(r.Context(), adminID, id); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Kredensial POS mobile berhasil dihapus", nil)
}

func (h *POSMobileCredentialHandler) Verify(w http.ResponseWriter, r *http.Request) {
	var req domain.VerifyPOSMobileCredentialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid: format JSON salah", nil)
		return
	}

	code := req.Key
	if code == "" {
		code = req.Code
	}
	if code == "" {
		code = req.SerialKey
	}

	code = strings.TrimSpace(code)
	if code == "" {
		response.Error(w, http.StatusBadRequest, "Kode acak verifikasi kredensial wajib diisi", nil)
		return
	}

	res, err := h.svc.Verify(r.Context(), code)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, res.Message, res)
}

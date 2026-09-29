package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type OpnameSessionHandler struct {
	service domain.OpnameSessionService
}

func NewOpnameSessionHandler(s domain.OpnameSessionService) *OpnameSessionHandler {
	return &OpnameSessionHandler{service: s}
}

func businessContext(r *http.Request) (businessID, outletID, actorID string, ok bool) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		return "", "", "", false
	}
	businessID = payload.ID
	outletID = r.PathValue("outlet_id")
	actorID = payload.ID
	return businessID, outletID, actorID, true
}

func deviceContext(r *http.Request) (businessID, outletID, deviceID string, ok bool) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		return "", "", "", false
	}
	businessID = payload.Email
	outletID = payload.ID
	deviceID = r.Header.Get("X-Device-Id")
	return businessID, outletID, deviceID, true
}

func writeServiceError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, service.ErrSOFormNotOpen):
		response.Error(w, http.StatusConflict, "Form SO tidak berstatus OPEN", map[string]string{"code": "SO_NOT_OPEN"})
	case errors.Is(err, service.ErrSOFormNotCounting):
		response.Error(w, http.StatusConflict, "Form SO tidak berstatus COUNTING", map[string]string{"code": "SO_NOT_COUNTING"})
	case errors.Is(err, service.ErrSOFormNotClosed):
		response.Error(w, http.StatusConflict, "Form SO tidak berstatus CLOSED", map[string]string{"code": "SO_NOT_CLOSED"})
	case errors.Is(err, service.ErrSOFormForbidden):
		response.Error(w, http.StatusForbidden, "Form SO bukan milik outlet ini", map[string]string{"code": "SO_FORBIDDEN"})
	case errors.Is(err, service.ErrSOFormNoItems):
		response.Error(w, http.StatusBadRequest, "Form SO tidak memiliki material", map[string]string{"code": "SO_NO_ITEMS"})
	case errors.Is(err, service.ErrSOFormNoCounts):
		response.Error(w, http.StatusBadRequest, "Belum ada hitungan yang disubmit", map[string]string{"code": "SO_NO_COUNTS"})
	default:
		response.Error(w, http.StatusInternalServerError, fallback, map[string]string{"error": err.Error()})
	}
}

// Group 1: Admin handlers

func (h *OpnameSessionHandler) CreateForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	var req domain.CreateSOFormRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", map[string]string{"error": err.Error()})
		return
	}

	result, err := h.service.CreateForm(r.Context(), businessID, outletID, actorID, &req)
	if err != nil {
		writeServiceError(w, err, "Gagal membuat form SO")
		return
	}

	response.Success(w, http.StatusCreated, "Form SO berhasil dibuat", result)
}

func (h *OpnameSessionHandler) ListForms(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	offset := 0
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	result, err := h.service.ListForms(r.Context(), businessID, outletID, status, limit, offset)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat daftar form SO")
		return
	}

	response.Success(w, http.StatusOK, "Daftar form SO", result)
}

func (h *OpnameSessionHandler) GetFormDetail(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.GetFormDetail(r.Context(), businessID, outletID, formID)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat detail form SO")
		return
	}

	response.Success(w, http.StatusOK, "Detail form SO", result)
}

func (h *OpnameSessionHandler) UpdateFormItems(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	var req domain.UpdateFormItemsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", map[string]string{"error": err.Error()})
		return
	}

	result, err := h.service.UpdateFormItems(r.Context(), businessID, outletID, formID, req.RawMaterialIDs)
	if err != nil {
		writeServiceError(w, err, "Gagal memperbarui material form SO")
		return
	}

	response.Success(w, http.StatusOK, "Material form SO diperbarui", result)
}

func (h *OpnameSessionHandler) PublishForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	err := h.service.PublishForm(r.Context(), businessID, outletID, formID)
	if err != nil {
		writeServiceError(w, err, "Gagal mempublish form SO")
		return
	}

	response.Success(w, http.StatusOK, "Form SO dipublish", map[string]string{"status": domain.SOStatusPublished})
}

func (h *OpnameSessionHandler) CloseForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.CloseForm(r.Context(), businessID, outletID, formID, actorID)
	if err != nil {
		writeServiceError(w, err, "Gagal menutup form SO")
		return
	}

	response.Success(w, http.StatusOK, "Form SO ditutup", result)
}

func (h *OpnameSessionHandler) ApproveForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.ApproveForm(r.Context(), businessID, outletID, formID, actorID)
	if err != nil {
		writeServiceError(w, err, "Gagal menyetujui form SO")
		return
	}

	response.Success(w, http.StatusOK, "Form SO disetujui, stok disesuaikan", result)
}

func (h *OpnameSessionHandler) RejectForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	err := h.service.RejectForm(r.Context(), businessID, outletID, formID, actorID)
	if err != nil {
		writeServiceError(w, err, "Gagal menolak form SO")
		return
	}

	response.Success(w, http.StatusOK, "Form SO ditolak", map[string]string{"status": domain.SOStatusRejected})
}

func (h *OpnameSessionHandler) RecountForm(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.RecountForm(r.Context(), businessID, outletID, formID, actorID)
	if err != nil {
		writeServiceError(w, err, "Gagal melakukan hitung ulang form SO")
		return
	}

	response.Success(w, http.StatusCreated, "Form recount berhasil dibuat", result)
}

// Group 2: Mobile/SO App handlers

func (h *OpnameSessionHandler) ListAvailable(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	result, err := h.service.ListAvailable(r.Context(), businessID, outletID)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat daftar form SO yang tersedia")
		return
	}

	response.Success(w, http.StatusOK, "Daftar SO tersedia", result)
}

func (h *OpnameSessionHandler) GetFormForCounting(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.GetFormForCounting(r.Context(), businessID, outletID, formID)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat detail form SO untuk dihitung")
		return
	}

	response.Success(w, http.StatusOK, "Detail form SO", result)
}

func (h *OpnameSessionHandler) SubmitCounts(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	staffID := strings.TrimSpace(r.Header.Get("X-Staff-Id"))
	if staffID == "" {
		response.Error(w, http.StatusBadRequest, "X-Staff-Id diperlukan", nil)
		return
	}

	formID := r.PathValue("form_id")
	var req domain.SubmitCountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format request tidak valid", map[string]string{"error": err.Error()})
		return
	}

	err := h.service.SubmitCounts(r.Context(), businessID, outletID, formID, staffID, req.Items)
	if err != nil {
		writeServiceError(w, err, "Gagal menyimpan hitungan")
		return
	}

	response.Success(w, http.StatusOK, "Hitungan berhasil disimpan", nil)
}

func (h *OpnameSessionHandler) GetMyCounts(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Tidak terotorisasi", nil)
		return
	}

	staffID := strings.TrimSpace(r.Header.Get("X-Staff-Id"))
	if staffID == "" {
		response.Error(w, http.StatusBadRequest, "X-Staff-Id diperlukan", nil)
		return
	}

	formID := r.PathValue("form_id")
	result, err := h.service.GetMyCounts(r.Context(), businessID, outletID, formID, staffID)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat hitungan")
		return
	}

	response.Success(w, http.StatusOK, "Hitungan saya", result)
}

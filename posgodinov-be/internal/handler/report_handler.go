package handler

import (
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type ReportHandler struct {
	service domain.ReportService
}

func NewReportHandler(service domain.ReportService) *ReportHandler {
	return &ReportHandler{service: service}
}

func (h *ReportHandler) getFilterFromContext(r *http.Request) (domain.ReportFilter, bool) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		return domain.ReportFilter{}, false
	}

	outletID := r.PathValue("outlet_id")

	filter := domain.ReportFilter{
		StartDate:  r.URL.Query().Get("start_date"),
		EndDate:    r.URL.Query().Get("end_date"),
		BusinessID: payload.ID, // Gunakan ID dari access token (Business ID)
		OutletID:   outletID,
	}

	// TODO: Jika suatu saat ada autentikasi terpisah untuk akun Tenant (Kepala Cabang),
	// logika pembedaan hak akses Outlet bisa ditambahkan di sini.
	// Saat ini, login Business (Owner) memegang payload.ID = BusinessID.

	return filter, true
}

func (h *ReportHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	filter, ok := h.getFilterFromContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	res, err := h.service.GetDashboard(r.Context(), filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil data dashboard", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Berhasil memuat dashboard statistik", res)
}

func (h *ReportHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	filter, ok := h.getFilterFromContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	res, err := h.service.GetTransactions(r.Context(), filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil detail transaksi", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Berhasil memuat detail transaksi", res)
}

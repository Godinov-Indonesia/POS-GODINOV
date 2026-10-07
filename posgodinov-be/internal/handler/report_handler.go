package handler

import (
	"errors"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
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

func (h *ReportHandler) ExportTransactions(w http.ResponseWriter, r *http.Request) {
	h.exportReport(w, r, "transactions")
}

func (h *ReportHandler) ExportWaste(w http.ResponseWriter, r *http.Request) {
	h.exportReport(w, r, "waste")
}

func (h *ReportHandler) ExportRestock(w http.ResponseWriter, r *http.Request) {
	h.exportReport(w, r, "restock")
}

func (h *ReportHandler) exportReport(w http.ResponseWriter, r *http.Request, reportType string) {
	filter, ok := h.getFilterFromContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	res, err := h.service.Export(r.Context(), reportType, filter)
	if err != nil {
		var quotaErr *service.QuotaExceededError
		if errors.As(err, &quotaErr) {
			response.QuotaExceeded(w, quotaErr.FeatureKey, quotaErr.CurrentUsage, quotaErr.LimitValue)
			return
		}
		if strings.Contains(err.Error(), "fitur ini tidak tersedia") || strings.Contains(err.Error(), "SUSPENDED") {
			response.Error(w, http.StatusForbidden, err.Error(), map[string]string{
				"code": "PLAN_LIMIT_EXCEEDED",
			})
			return
		}
		response.Error(w, http.StatusInternalServerError, "Gagal mengekspor data laporan", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Berhasil mengekspor data laporan", res)
}

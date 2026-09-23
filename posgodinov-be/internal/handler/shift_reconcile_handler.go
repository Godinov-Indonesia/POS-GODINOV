package handler

import (
	"net/http"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

// ShiftReconcileHandler melayani layar Rekonsiliasi Shift milik PEMILIK
// ([11 §M15.3]).
//
// ⚠️ Rute ini berada di bawah autentikasi Business, BUKAN device token. Itulah
// satu-satunya hal yang memisahkannya dari pelanggaran aturan R3: isinya
// memang angka ekspektasi dan selisih, dan angka itu tidak boleh pernah
// mencapai perangkat yang dipegang kasir.
type ShiftReconcileHandler struct {
	service domain.ShiftReconcileService
}

func NewShiftReconcileHandler(service domain.ShiftReconcileService) *ShiftReconcileHandler {
	return &ShiftReconcileHandler{service: service}
}

// List mengembalikan rekonsiliasi shift satu outlet pada rentang tanggal.
func (h *ShiftReconcileHandler) List(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	filter := domain.ShiftReconciliationFilter{
		// Diambil dari token, BUKAN dari query string. Membacanya dari
		// permintaan akan membuat siapa pun yang punya token sah dapat membaca
		// rekonsiliasi bisnis lain hanya dengan mengganti satu parameter.
		BusinessID: payload.ID,
		OutletID:   r.PathValue("outlet_id"),
		StartDate:  r.URL.Query().Get("start_date"),
		EndDate:    r.URL.Query().Get("end_date"),
	}

	rows, err := h.service.List(r.Context(), filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memuat rekonsiliasi shift",
			map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Berhasil memuat rekonsiliasi shift", rows)
}

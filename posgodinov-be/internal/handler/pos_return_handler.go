package handler

import (
	"errors"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

// POSReturnHandler melayani endpoint retur sisi perangkat ([11 §4.5]).
type POSReturnHandler struct {
	service domain.ReturnService
}

func NewPOSReturnHandler(svc domain.ReturnService) *POSReturnHandler {
	return &POSReturnHandler{service: svc}
}

// Returnable menangani `GET /v1/pos/transactions/{id}/returnable`.
//
// ═══════════════════════════════════════════════════════════════════════════
// MENGAPA ENDPOINT INI ADA
// ═══════════════════════════════════════════════════════════════════════════
//
// Perangkat yang menemukan transaksi lewat pencarian Kode Struk (butir 16)
// tidak memiliki riwayat returnya secara lokal. Menghitung sisa di klien
// mustahil benar: retur dari perangkat lain tidak pernah terlihat sampai
// sinkronisasi berikutnya, dan kasir akan diberi tahu "sisa 2" untuk barang
// yang sudah habis diretur di kasir sebelah.
//
// Jawaban yang dikembalikan **bukan** jaminan. Ia dapat basi begitu tiba;
// penegak sesungguhnya tetap `ReturnService.Create` dengan `SELECT … FOR
// UPDATE`. Endpoint ini semata mencegah kasir mengisi formulir yang pasti
// ditolak.
func (h *POSReturnHandler) Returnable(w http.ResponseWriter, r *http.Request) {
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

	transactionID := strings.TrimSpace(r.PathValue("id"))
	if transactionID == "" {
		response.Error(w, http.StatusBadRequest, "ID transaksi wajib diisi", nil)
		return
	}

	res, err := h.service.Returnable(r.Context(), outletID, transactionID)
	if err != nil {
		var fieldErr *domain.SyncFieldError
		if errors.As(err, &fieldErr) {
			// `404`, bukan `422`: dari sudut pandang perangkat ini, transaksi
			// milik outlet lain memang tidak ada. Membedakan "tidak ada" dari
			// "bukan milik Anda" akan membocorkan keberadaan transaksi outlet
			// lain kepada siapa pun yang menebak UUID.
			// Satu-satunya `SyncFieldError` yang dapat keluar dari `Returnable`
			// adalah transaksi yang tidak ditemukan atau bukan milik outlet ini;
			// memanggil pemeta galat dari paket `service` hanya akan membalik
			// arah ketergantungan lapisan demi satu string.
			response.Error(w, http.StatusNotFound, fieldErr.Message, map[string]string{
				"code": domain.ErrCodeOriginalNotFound,
			})
			return
		}
		response.Error(w, http.StatusInternalServerError, "Gagal membaca sisa retur", nil)
		return
	}

	response.Success(w, http.StatusOK, "Sisa retur berhasil dibaca", res)
}

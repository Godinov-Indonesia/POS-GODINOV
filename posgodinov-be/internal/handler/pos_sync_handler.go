package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
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

	// Setiap respons menyatakan versi kontrak yang dilayani, sehingga perangkat
	// lapangan dapat mengetahui kapan jendela deprekasi v1 ditutup tanpa perlu
	// endpoint terpisah ([11 §4.1]).
	w.Header().Set(domain.ContractSupportedHeader, domain.ContractSupportedVersion)

	req, err := decodeSyncUpRequest(r)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Format payload tidak valid", map[string]string{"error": err.Error()})
		return
	}

	res, err := h.service.SyncUp(r.Context(), businessID, outletID, req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Proses sinkronisasi transaksi selesai", res)
}

// decodeSyncUpRequest memilih parser berdasarkan `X-POS-Contract-Version`.
//
// # Mengapa dispatch, bukan satu parser yang memaafkan segalanya
//
// Perangkat di lapangan tidak dapat diperbarui serentak. Sebuah tablet yang mati
// selama dua minggu akan kembali online membawa payload v1 berisi transaksi asli
// yang uangnya sudah diterima; menolaknya berarti menghapus penjualan nyata.
//
// # Mengapa keduanya menghasilkan struct yang sama
//
// `SyncUpRequestV2` menyematkan `SyncUpRequest`, sehingga JSON v1 terurai
// sepenuhnya olehnya: kunci `shifts`/`transactions`/`wastes` naik ke tingkat
// atas dan koleksi v2 tinggal kosong. Karena itu percabangan versi BERHENTI di
// sini dan tidak pernah merembet ke lapisan service — satu-satunya cara menjaga
// dua versi kontrak tetap dapat diuji tanpa menduplikasi logika bisnis.
//
// `DisallowUnknownFields` sengaja TIDAK dipakai: perangkat versi berikutnya
// harus dapat mengirim field yang belum dikenal server tanpa seluruh batch-nya
// ditolak.
func decodeSyncUpRequest(r *http.Request) (*domain.SyncUpRequestV2, error) {
	var req domain.SyncUpRequestV2
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, err
	}

	// Payload v1 tidak membawa `device_id`. Menandainya di sini membuat baris
	// yang lahir dari perangkat lama tetap dapat dibedakan di basis data,
	// alih-alih menyamar sebagai perangkat v2 tanpa identitas.
	if r.Header.Get(domain.ContractVersionHeader) != domain.ContractVersionV2 {
		req.DeviceID = ""
		// Koleksi v2 pada permintaan berlabel v1 diabaikan, bukan diproses.
		// Klien yang belum menyatakan dirinya v2 belum tentu memahami bentuk
		// respons v2, dan memprosesnya diam-diam membuat kegagalan sulit
		// ditelusuri saat rilis bertahap M18.2.
		req.Returns = nil
		req.VoidLogs = nil
		req.SecurityEvents = nil
	}

	return &req, nil
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

// LookupTransaction — `GET /v1/pos/transactions/lookup?code=` ([11 §M17.3]).
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU-SATUNYA JALAN KASIR MENUJU TRANSAKSI LAMPAU — BUTIR 16
// ═══════════════════════════════════════════════════════════════════════════
//
// Layar Riwayat kini hanya menampilkan shift berjalan. Endpoint ini adalah
// pintu sempit menuju sisanya: satu kode, satu transaksi.
//
// Outlet diambil dari DEVICE TOKEN, tidak pernah dari query string. Membacanya
// dari permintaan akan membuat siapa pun yang punya device token sah dapat
// membaca transaksi cabang lain hanya dengan mengganti satu parameter.
func (h *POSSyncHandler) LookupTransaction(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok || payload.ID == "" {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	code := r.URL.Query().Get("code")

	trx, err := h.service.LookupTransaction(r.Context(), payload.ID, code)
	if err != nil {
		// `404`, bukan `400`, untuk kode yang tidak ditemukan — dan pesan yang
		// SAMA untuk kode yang tidak ada maupun milik outlet lain. Membedakannya
		// akan membocorkan keberadaan transaksi cabang lain lewat pesan galat.
		if len(strings.TrimSpace(code)) < service.MinLookupCodeLength {
			response.Error(w, http.StatusBadRequest, err.Error(),
				map[string]string{"code": "LOOKUP_CODE_TOO_SHORT"})
			return
		}
		response.Error(w, http.StatusNotFound, "Transaksi tidak ditemukan",
			map[string]string{"code": "TRANSACTION_NOT_FOUND"})
		return
	}

	response.Success(w, http.StatusOK, "Transaksi ditemukan", trx)
}

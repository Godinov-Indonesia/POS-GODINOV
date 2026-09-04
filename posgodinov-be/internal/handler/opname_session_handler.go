package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

// OpnameSessionHandler melayani DUA jenis pemanggil sekaligus, dan perbedaannya
// mengikat ([11 §M16.3]).
//
// ═══════════════════════════════════════════════════════════════════════════
// RUTE PERANGKAT vs RUTE PEMILIK
// ═══════════════════════════════════════════════════════════════════════════
//
//	/v1/opname/…            device token ber-scope OPNAME   → hanya bentuk DRAFT
//	/v1/business/outlets/…  token bisnis                    → bentuk LOCKED
//
// Pemisahan itu ditegakkan di router (middleware berbeda), bukan di sini.
// Handler ini hanya memastikan setiap metode memanggil metode service yang
// bentuk responsnya benar: metode ber-`Draft` tidak mampu mengembalikan angka
// ekspektasi karena DTO-nya tidak memilikinya.
type OpnameSessionHandler struct {
	service domain.OpnameSessionService
}

func NewOpnameSessionHandler(s domain.OpnameSessionService) *OpnameSessionHandler {
	return &OpnameSessionHandler{service: s}
}

/* ── Konteks pemanggil ────────────────────────────────────────────────────── */

// deviceContext membaca identitas dari device token ber-scope OPNAME.
//
// Sama seperti jalur kasir, `payload.Email` menyimpan `business_id` dan
// `payload.ID` menyimpan `outlet_id` — konvensi yang sudah ada sejak v1.
func deviceContext(r *http.Request) (businessID, outletID, deviceID string, ok bool) {
	payload, found := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !found || payload.Email == "" || payload.ID == "" {
		return "", "", "", false
	}
	return payload.Email, payload.ID, r.Header.Get("X-Device-Id"), true
}

// businessContext membaca identitas dari token bisnis + `outlet_id` pada path.
func businessContext(r *http.Request) (businessID, outletID, actorID string, ok bool) {
	payload, found := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !found {
		return "", "", "", false
	}
	return payload.ID, r.PathValue("outlet_id"), payload.ID, true
}

// writeServiceError memetakan galat layanan ke status HTTP.
//
// Memakai sentinel, BUKAN pencocokan teks: pesan galat berubah setiap kali ada
// yang memperbaikinya, dan pemetaan yang bergantung pada teks akan diam-diam
// berhenti bekerja tanpa satu pun uji gagal.
func writeServiceError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, service.ErrOpnameAlreadyLocked):
		response.Error(w, http.StatusConflict, "Sesi opname sudah terkunci dan tidak dapat diubah",
			map[string]string{"code": "OPNAME_ALREADY_LOCKED"})
	case errors.Is(err, service.ErrOpnameNotLocked):
		response.Error(w, http.StatusConflict, "Sesi opname belum terkunci",
			map[string]string{"code": "OPNAME_NOT_LOCKED"})
	case errors.Is(err, service.ErrOpnameForbidden):
		response.Error(w, http.StatusForbidden, "Sesi opname bukan milik outlet ini",
			map[string]string{"code": "OPNAME_FORBIDDEN"})
	default:
		response.Error(w, http.StatusInternalServerError, fallback,
			map[string]string{"error": err.Error()})
	}
}

/* ── Rute perangkat (scope OPNAME) ────────────────────────────────────────── */

// CreateSession — `POST /v1/opname/sessions`.
func (h *OpnameSessionHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, deviceID, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	var req domain.CreateOpnameSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format payload tidak valid",
			map[string]string{"error": err.Error()})
		return
	}

	// `counted_by` diambil dari header, bukan body: petugas yang mengetik id
	// orang lain ke dalam body akan menandatangani hitungan atas nama mereka.
	countedBy := r.Header.Get("X-Staff-Id")
	if countedBy == "" {
		response.Error(w, http.StatusBadRequest, "Header X-Staff-Id wajib diisi", nil)
		return
	}

	session, err := h.service.Create(r.Context(), businessID, outletID, deviceID, countedBy, &req)
	if err != nil {
		writeServiceError(w, err, "Gagal membuat sesi opname")
		return
	}

	response.Success(w, http.StatusCreated, "Sesi opname dibuat", session)
}

// UpsertItems — `PUT /v1/opname/sessions/{session_id}/items`.
//
// ⚠️ Responsnya [domain.OpnameDraftResponse]. Tidak ada jalur di dalam handler
// ini yang mampu mengembalikan `system_stock`: DTO-nya tidak punya field itu.
func (h *OpnameSessionHandler) UpsertItems(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	var body struct {
		Items []*domain.UpsertOpnameItemRequest `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Format payload tidak valid",
			map[string]string{"error": err.Error()})
		return
	}

	draft, err := h.service.UpsertItems(r.Context(), businessID, outletID, r.PathValue("session_id"), body.Items)
	if err != nil {
		writeServiceError(w, err, "Gagal menyimpan hitungan opname")
		return
	}

	response.Success(w, http.StatusOK, "Hitungan tersimpan", draft)
}

// GetDraft — `GET /v1/opname/sessions/{session_id}`.
func (h *OpnameSessionHandler) GetDraft(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	draft, err := h.service.GetDraft(r.Context(), businessID, outletID, r.PathValue("session_id"))
	if err != nil {
		writeServiceError(w, err, "Gagal memuat sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Sesi opname dimuat", draft)
}

// Lock — `POST /v1/opname/sessions/{session_id}/lock`.
//
// SATU-SATUNYA endpoint perangkat yang mengembalikan angka ekspektasi, dan
// hanya setelah penguncian benar-benar terjadi ([11 §4.6]).
func (h *OpnameSessionHandler) Lock(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := deviceContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Kredensial token tidak lengkap", nil)
		return
	}

	// Konfirmasi eksplisit di body. Penguncian tidak dapat dibatalkan, dan
	// permintaan POST tanpa body terlalu mudah terkirim karena salah ketuk.
	var body struct {
		Confirm bool `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !body.Confirm {
		response.Error(w, http.StatusBadRequest,
			"Penguncian memerlukan konfirmasi eksplisit: kirim {\"confirm\": true}", nil)
		return
	}

	locked, err := h.service.Lock(r.Context(), businessID, outletID, r.PathValue("session_id"))
	if err != nil {
		writeServiceError(w, err, "Gagal mengunci sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Sesi opname terkunci", locked)
}

/* ── Rute pemilik (token bisnis) ──────────────────────────────────────────── */

// ListSessions — `GET /v1/business/outlets/{outlet_id}/opname/sessions`.
func (h *OpnameSessionHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	sessions, err := h.service.ListSessions(r.Context(), businessID, outletID,
		r.URL.Query().Get("status"), limit, offset)
	if err != nil {
		writeServiceError(w, err, "Gagal memuat daftar sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Daftar sesi opname dimuat", sessions)
}

// GetSessionDetail — `GET /v1/business/outlets/{outlet_id}/opname/sessions/{session_id}`.
//
// Menolak sesi `DRAFT` dengan `409`, bahkan untuk pemilik — lihat catatan pada
// `OpnameSessionService.GetLocked`.
func (h *OpnameSessionHandler) GetSessionDetail(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, _, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	detail, err := h.service.GetLocked(r.Context(), businessID, outletID, r.PathValue("session_id"))
	if err != nil {
		writeServiceError(w, err, "Gagal memuat detail sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Detail sesi opname dimuat", detail)
}

// Approve — `POST /v1/business/outlets/{outlet_id}/opname/sessions/{session_id}/approve`.
func (h *OpnameSessionHandler) Approve(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	result, err := h.service.Approve(r.Context(), businessID, outletID, r.PathValue("session_id"), actorID)
	if err != nil {
		writeServiceError(w, err, "Gagal menyetujui sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Sesi opname disetujui, stok disesuaikan", result)
}

// Reject — `POST /v1/business/outlets/{outlet_id}/opname/sessions/{session_id}/reject`.
func (h *OpnameSessionHandler) Reject(w http.ResponseWriter, r *http.Request) {
	businessID, outletID, actorID, ok := businessContext(r)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	if err := h.service.Reject(r.Context(), businessID, outletID, r.PathValue("session_id"), actorID); err != nil {
		writeServiceError(w, err, "Gagal menolak sesi opname")
		return
	}

	response.Success(w, http.StatusOK, "Sesi opname ditolak", map[string]string{
		"status": domain.OpnameStatusRejected,
	})
}

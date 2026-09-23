package domain

import "context"

// ════════════════════════════════════════════════════════════════════════════
// KONTRAK v1 — dipertahankan apa adanya selama jendela deprekasi ([11 §4.1])
// ════════════════════════════════════════════════════════════════════════════

type SyncUpRequest struct {
	Shifts       []*Shift        `json:"shifts"`
	Transactions []*Transaction  `json:"transactions"`
	Wastes       []*ProductWaste `json:"wastes"`
}

// ════════════════════════════════════════════════════════════════════════════
// KONTRAK v2 ([11 §4.2])
// ════════════════════════════════════════════════════════════════════════════

// Header penanda versi kontrak. Tanpa header, permintaan diperlakukan sebagai
// v1 — perangkat lapangan yang mati dua minggu tidak boleh ditolak hanya karena
// tidak tahu ada versi baru.
const (
	ContractVersionHeader    = "X-POS-Contract-Version"
	ContractSupportedHeader  = "X-POS-Contract-Supported"
	ContractVersionV1        = "1"
	ContractVersionV2        = "2"
	ContractSupportedVersion = "1,2"
)

// SyncUpRequestV2 MENYEMATKAN bentuk v1, bukan menggantinya.
//
// Penyematan membuat JSON v1 dan v2 terurai oleh satu struct yang sama: kunci
// `shifts`/`transactions`/`wastes` naik ke tingkat atas, dan koleksi baru
// tinggal absen pada payload v1. Konsekuensinya, lapisan service hanya perlu
// mengenal SATU bentuk — percabangan berhenti di dekoder, tidak merembet ke
// logika bisnis.
type SyncUpRequestV2 struct {
	SyncUpRequest

	DeviceID string `json:"device_id"`
	// Versi master data yang dipegang perangkat saat payload disusun (butir 10).
	MasterDataVersion *int64 `json:"master_data_version"`

	Returns        []*Return        `json:"returns"`
	VoidLogs       []*VoidLog       `json:"void_logs"`
	SecurityEvents []*SecurityEvent `json:"security_events"`
}

// IsV2Payload menandai payload yang benar-benar membawa muatan v2.
//
// Dipakai untuk telemetri jendela deprekasi: header dapat dipasang perangkat
// yang belum benar-benar mengirim entitas baru.
func (r *SyncUpRequestV2) IsV2Payload() bool {
	return r.DeviceID != "" || len(r.Returns) > 0 || len(r.VoidLogs) > 0 ||
		len(r.SecurityEvents) > 0
}

type SyncUpResponse struct {
	ShiftsSynced       int      `json:"shifts_synced"`
	TransactionsSynced int      `json:"transactions_synced"`
	WastesSynced       int      `json:"wastes_synced"`
	FailedTransactions []string `json:"failed_transactions,omitempty"`

	// ── v2 ──────────────────────────────────────────────────────────────────
	ReturnsSynced        int `json:"returns_synced"`
	VoidLogsSynced       int `json:"void_logs_synced"`
	SecurityEventsSynced int `json:"security_events_synced"`

	// Galat per-entitas beserta alasannya ([11 §4.3]).
	//
	// `FailedTransactions` di atas dipertahankan agar klien v1 tetap berfungsi,
	// tetapi ia tidak pernah dapat memberi tahu kasir MENGAPA barisnya ditolak —
	// sehingga layar antrean hanya bisa menyuruh "coba lagi" tanpa akhir.
	Errors []*SyncError `json:"errors,omitempty"`

	// Versi master data TERKINI di server. Klien membandingkannya dengan
	// miliknya untuk tahu bahwa master-nya kedaluwarsa (butir 10).
	MasterDataVersion int64 `json:"master_data_version"`
}

// AddError mencatat satu kegagalan dan menjaga `FailedTransactions` tetap
// terisi untuk klien v1.
func (r *SyncUpResponse) AddError(entity, id, code, message string, retryable bool) {
	r.Errors = append(r.Errors, &SyncError{
		Entity:    entity,
		ID:        id,
		Code:      code,
		Message:   message,
		Retryable: retryable,
	})
	if entity == EntityTransaction {
		r.FailedTransactions = append(r.FailedTransactions, id)
	}
}

type POSSyncService interface {
	GetMasterData(ctx context.Context, businessID, outletID string) (*SyncMasterDataResponse, error)
	SyncUp(ctx context.Context, businessID, outletID string, req *SyncUpRequestV2) (*SyncUpResponse, error)
	GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*Transaction, error)

	// LookupTransaction — butir 16 ([11 §M17.3]). Satu transaksi, bukan daftar.
	LookupTransaction(ctx context.Context, outletID, code string) (*Transaction, error)
}

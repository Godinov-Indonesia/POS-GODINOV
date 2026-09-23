package domain

import (
	"context"
	"fmt"
)

// Kode galat sinkronisasi — kontrak dengan klien ([11 §4.3]).
//
// Klien memutuskan nasib sebuah baris dari `Retryable`, bukan dari kode ini;
// kode dipakai untuk pesan yang dapat dibaca kasir dan untuk telemetri.
const (
	ErrCodeTenderMismatch      = "TENDER_MISMATCH"
	ErrCodeCardDetailsRequired = "CARD_DETAILS_REQUIRED"
	ErrCodeInvalidTender       = "INVALID_TENDER"
	ErrCodeVoidAfterPrint      = "VOID_AFTER_PRINT"
	ErrCodeReturnExceeds       = "RETURN_EXCEEDS_ORIGINAL"
	ErrCodeShortCodeCollision  = "SHORT_CODE_COLLISION"
	ErrCodeShiftOpenOnDevice   = "SHIFT_ALREADY_OPEN_ON_DEVICE"
	ErrCodeShiftOpenOnStaff    = "SHIFT_ALREADY_OPEN_ON_STAFF"

	// Butir 10 — shift dibuka tanpa master data yang sah ([11 §M15.1]).
	//
	// TIDAK retryable: mengirim ulang baris yang sama tidak akan membuatnya
	// tiba-tiba membawa versi master data. Perangkat harus menarik master lalu
	// membuka shift baru, dan barisnya dikarantina agar tidak memblokir antrean.
	ErrCodeMasterDataRequired = "MASTER_DATA_REQUIRED"
	ErrCodeOriginalNotFound    = "ORIGINAL_TRANSACTION_NOT_FOUND"
	ErrCodeInvalidPayload      = "INVALID_PAYLOAD"
	ErrCodePersistFailed       = "PERSIST_FAILED"
)

// SyncFieldError menandai payload yang cacat secara struktural.
//
// Cacat semacam ini TIDAK PERNAH sembuh dengan mengirim ulang — nominal tender
// yang tidak seimbang akan tetap tidak seimbang pada percobaan keseribu. Karena
// itu ia dipetakan ke `Retryable: false` dan barisnya masuk karantina di klien.
type SyncFieldError struct {
	Field   string
	Message string
}

func NewSyncFieldError(field, message string) *SyncFieldError {
	return &SyncFieldError{Field: field, Message: message}
}

func (e *SyncFieldError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// SyncError adalah satu galat per-entitas pada respons ([11 §4.3]).
//
// v1 hanya melaporkan `failed_transactions` berupa array string, yang tidak
// pernah dapat memberi tahu kasir MENGAPA barisnya ditolak — sehingga layar
// antrean hanya bisa menyuruh "coba lagi" tanpa akhir.
type SyncError struct {
	// shift | transaction | return | void_log | waste | security_event
	Entity  string `json:"entity"`
	ID      string `json:"id"`
	Code    string `json:"code"`
	Message string `json:"message"`

	// false memindahkan baris ke KARANTINA di klien: ia keluar dari antrean dan
	// berhenti memblokir baris di belakangnya. Tanpa ini, satu baris cacat
	// permanen membusukkan seluruh antrean di belakangnya.
	Retryable bool `json:"retryable"`
}

// Entitas yang dilacak pada `SyncError.Entity`.
const (
	EntityShift         = "shift"
	EntityTransaction   = "transaction"
	EntityReturn        = "return"
	EntityVoidLog       = "void_log"
	EntityWaste         = "waste"
	EntitySecurityEvent = "security_event"
)

// MasterVersionRepository menjaga penghitung versi master data per outlet
// (butir 10).
//
// `Bump` WAJIB dipanggil di dalam transaksi basis data YANG SAMA dengan mutasi
// produk, kategori, resep, atau staff. Memanggilnya setelah commit membuka
// jendela saat perangkat menarik master data lama tetapi mencatat versi baru —
// dan gerbang Buka Shift akan meloloskannya.
type MasterVersionRepository interface {
	Get(ctx context.Context, outletID string) (int64, error)
	Bump(ctx context.Context, outletID string) (int64, error)
}

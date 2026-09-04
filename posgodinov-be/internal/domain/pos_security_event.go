package domain

import (
	"context"
	"time"
)

// Bobot peristiwa audit.
const (
	SeverityInfo     = "INFO"
	SeverityWarn     = "WARN"
	SeverityCritical = "CRITICAL"
)

// Kamus `event_type` ([11 §3.3]).
//
// Sengaja konstanta string dan BUKAN enum tertutup: peristiwa baru akan
// bermunculan sepanjang umur produk, dan perangkat lama harus tetap dapat
// mengirim jenis yang belum dikenal server tanpa ditolak. Server menyimpan apa
// adanya; pengelompokan terjadi di laporan.
const (
	EventKioskExitGranted         = "KIOSK_EXIT_GRANTED"
	EventKioskExitDenied          = "KIOSK_EXIT_DENIED"
	EventLogoutBlockedActiveShift = "LOGOUT_BLOCKED_ACTIVE_SHIFT"
	EventStaffSwitchBlocked       = "STAFF_SWITCH_BLOCKED"
	EventOpenShiftBlockedStale    = "OPEN_SHIFT_BLOCKED_STALE_MASTER"
	EventQtyDecreaseEscalated     = "QTY_DECREASE_ESCALATED_TO_VOID"
	EventVoidReceiptPrintFailed   = "VOID_RECEIPT_PRINT_FAILED"
	EventWasteReceiptPrintFailed  = "WASTE_RECEIPT_PRINT_FAILED"
	EventReceiptReprinted         = "RECEIPT_REPRINTED"
	EventVoidAfterPrintAttempted  = "VOID_AFTER_PRINT_ATTEMPTED"
	EventPINFailedThreshold       = "PIN_FAILED_THRESHOLD"
	EventClockSkewDetected        = "CLOCK_SKEW_DETECTED"
)

var validSeverities = map[string]struct{}{
	SeverityInfo: {}, SeverityWarn: {}, SeverityCritical: {},
}

// SecurityEvent adalah kanal audit yang IKUT ANTRE SYNC (aturan R9).
//
// `audit_logs` yang ada hanya menangkap permintaan HTTP. Kecurangan di POS
// terjadi justru ketika perangkat offline — dan tidak ada satu pun permintaan
// HTTP yang lahir dari peristiwa itu.
type SecurityEvent struct {
	ID         string `json:"id" gorm:"primaryKey;column:id"`
	OutletID   string `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID string `json:"business_id" gorm:"column:business_id"`
	DeviceID   string `json:"device_id" gorm:"column:device_id"`

	// Nullable: peristiwa dapat terjadi sebelum shift mana pun dibuka, mis.
	// kegagalan PIN berulang di layar login.
	ShiftID *string `json:"shift_id" gorm:"column:shift_id"`
	StaffID *string `json:"staff_id" gorm:"column:staff_id"`

	EventType string `json:"event_type" gorm:"column:event_type"`
	Severity  string `json:"severity" gorm:"column:severity"`

	// ⛔ Aturan R8: tidak boleh memuat PIN, hash PIN, atau data kartu.
	Details JSONB `json:"details,omitempty" gorm:"column:details;type:jsonb"`

	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

// TableName menimpa pluralisasi GORM.
//
// GORM akan menebak `security_events`, sedangkan tabelnya bernama
// `pos_security_events` — awalan `pos_` membedakannya dari `audit_logs` yang
// mencatat lalu lintas HTTP. Tanpa penimpaan ini, seluruh kueri gagal dengan
// "relation does not exist" hanya pada saat runtime.
func (SecurityEvent) TableName() string {
	return "pos_security_events"
}

// Normalize melengkapi nilai yang hilang alih-alih menolak barisnya.
//
// Peristiwa keamanan adalah satu-satunya sinyal yang dimiliki pemilik tentang
// apa yang terjadi saat perangkat offline. Menolak sebuah peristiwa karena
// `severity`-nya kosong berarti menghapus bukti demi kerapian — pertukaran yang
// selalu salah arah. Yang tidak dapat diperbaiki hanyalah `event_type` kosong,
// karena peristiwa tanpa jenis tidak menyatakan apa pun.
func (e *SecurityEvent) Normalize() error {
	if e.EventType == "" {
		return NewSyncFieldError("event_type", "jenis peristiwa keamanan wajib diisi")
	}
	if _, ok := validSeverities[e.Severity]; !ok {
		e.Severity = SeverityInfo
	}
	if len(e.Details) == 0 {
		e.Details = JSONB("{}")
	}
	return nil
}

type SecurityEventRepository interface {
	Save(ctx context.Context, event *SecurityEvent) error
	ListByOutlet(ctx context.Context, outletID string, limit, offset int) ([]*SecurityEvent, error)
}

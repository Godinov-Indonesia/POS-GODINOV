package domain

import (
	"context"
	"time"
)

// Cakupan pembatalan ([11 §3.2]).
//
// VoidScopeCartLine dan VoidScopeHeldOrder membatalkan sesuatu yang BELUM
// menjadi transaksi — itulah alasan `void_logs` harus berdiri sebagai tabel
// sendiri dan tidak dapat direduksi menjadi kolom di `transactions`.
const (
	VoidScopeCartLine    = "CART_LINE"
	VoidScopeHeldOrder   = "HELD_ORDER"
	VoidScopeTransaction = "TRANSACTION"
)

// VoidLog mencatat SELURUH peristiwa pembatalan — butir 5, 6, 13, 15.
//
// # Mengapa peristiwa pra-transaksi ikut dicatat
//
// Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
// membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar, selisih 6
// masuk kantong. Tanpa baris ini peristiwa tersebut tidak meninggalkan jejak
// apa pun — tidak ada transaksi, tidak ada stok bergerak, tidak ada yang bisa
// diaudit.
type VoidLog struct {
	ID         string `json:"id" gorm:"primaryKey;column:id"`
	OutletID   string `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID string `json:"business_id" gorm:"column:business_id"`
	DeviceID   string `json:"device_id" gorm:"column:device_id"`
	ShiftID    string `json:"shift_id" gorm:"column:shift_id"`

	StaffID      string  `json:"staff_id" gorm:"column:staff_id"`
	AuthorizedBy *string `json:"authorized_by" gorm:"column:authorized_by"`

	Scope string `json:"scope" gorm:"column:scope"`

	TransactionID *string `json:"transaction_id" gorm:"column:transaction_id"`
	// Lokal-only: server tidak mengenal konsep pesanan tertahan, sehingga id ini
	// tidak pernah dapat divalidasi terhadap tabel mana pun.
	HeldCartID *string `json:"held_cart_id" gorm:"column:held_cart_id"`
	ProductID  *string `json:"product_id" gorm:"column:product_id"`

	QuantityBefore int     `json:"quantity_before" gorm:"column:quantity_before"`
	QuantityAfter  int     `json:"quantity_after" gorm:"column:quantity_after"`
	ValueAmount    float64 `json:"value_amount" gorm:"column:value_amount"`

	ReasonCode  string `json:"reason_code" gorm:"column:reason_code"`
	ReasonNotes string `json:"reason_notes" gorm:"column:reason_notes"`

	ReceiptPrinted   bool       `json:"receipt_printed" gorm:"column:receipt_printed"`
	ReceiptPrintedAt *time.Time `json:"receipt_printed_at,omitempty" gorm:"column:receipt_printed_at"`

	// Salinan item untuk scope HELD_ORDER/TRANSACTION. Pesanan tertahan tidak
	// pernah ada di server; tanpa snapshot ini, isi pesanan yang dibatalkan
	// hilang selamanya dan audit hanya melihat nominal tanpa penjelasan.
	ItemsSnapshot JSONB `json:"items_snapshot,omitempty" gorm:"column:items_snapshot;type:jsonb"`

	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

func (v *VoidLog) Validate() error {
	switch v.Scope {
	case VoidScopeTransaction:
		if v.TransactionID == nil || *v.TransactionID == "" {
			return NewSyncFieldError("transaction_id", "void bercakupan TRANSACTION wajib merujuk transaksi")
		}
	case VoidScopeHeldOrder:
		if v.HeldCartID == nil || *v.HeldCartID == "" {
			return NewSyncFieldError("held_cart_id", "void bercakupan HELD_ORDER wajib merujuk pesanan tertahan")
		}
	case VoidScopeCartLine:
		if v.ProductID == nil || *v.ProductID == "" {
			return NewSyncFieldError("product_id", "void bercakupan CART_LINE wajib merujuk produk")
		}
	default:
		return NewSyncFieldError("scope", "cakupan void tidak dikenal: "+v.Scope)
	}

	if v.ShiftID == "" {
		return NewSyncFieldError("shift_id", "void wajib terikat pada satu shift")
	}
	if v.ReasonCode == "" {
		return NewSyncFieldError("reason_code", "alasan pembatalan wajib diisi")
	}
	if v.QuantityAfter > v.QuantityBefore {
		return NewSyncFieldError("quantity_after", "kuantitas sesudah tidak boleh melebihi kuantitas sebelum")
	}
	if v.ValueAmount < 0 {
		return NewSyncFieldError("value_amount", "nilai yang dibatalkan tidak boleh negatif")
	}
	return nil
}

type VoidLogRepository interface {
	Save(ctx context.Context, log *VoidLog) error
	GetByID(ctx context.Context, id string) (*VoidLog, error)
	ListByShift(ctx context.Context, shiftID string) ([]*VoidLog, error)
}

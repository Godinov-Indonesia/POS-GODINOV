package domain

import (
	"context"
	"time"
)

// Nilai sah `returns.return_type` dan `returns.refund_method` ([11 §3.5]).
const (
	ReturnTypeFull    = "FULL"
	ReturnTypePartial = "PARTIAL"

	RefundCash         = "CASH"
	RefundCardReversal = "CARD_REVERSAL"
	RefundQRISReversal = "QRIS_REVERSAL"
	RefundExchange     = "EXCHANGE"
	RefundStoreCredit  = "STORE_CREDIT"
)

// Agregat retur pada `transactions.return_state` — DIHITUNG SERVER.
const (
	ReturnStateNone    = "NONE"
	ReturnStatePartial = "PARTIAL"
	ReturnStateFull    = "FULL"
)

var validRefundMethods = map[string]struct{}{
	RefundCash: {}, RefundCardReversal: {}, RefundQRISReversal: {},
	RefundExchange: {}, RefundStoreCredit: {},
}

// Return adalah peristiwa keuangan BARU, bukan perubahan atas transaksi asal.
//
// Struk yang sudah keluar dari printer adalah dokumen yang berpindah tangan ke
// pelanggan. Mengubah transaksi asal setelah dokumen itu terbit berarti
// menerbitkan realitas kedua yang bertentangan dengan kertas di tangan
// pelanggan — persis lubang yang dipakai kecurangan "cetak dulu, batalkan
// belakangan" ([11 §2.1]).
//
// Karena itu transaksi asal tetap `COMPLETED` selamanya; hanya kolom turunan
// `return_state` yang dihitung ulang.
type Return struct {
	ID                    string `json:"id" gorm:"primaryKey;column:id"`
	OriginalTransactionID string `json:"original_transaction_id" gorm:"column:original_transaction_id"`

	// Shift SAAT RETUR TERJADI — sengaja dapat berbeda dari shift transaksi
	// asal. Pelanggan yang kembali besok adalah kasus ritel normal.
	ShiftID    string `json:"shift_id" gorm:"column:shift_id"`
	OutletID   string `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID string `json:"business_id" gorm:"column:business_id"`
	DeviceID   string `json:"device_id" gorm:"column:device_id"`

	StaffID      string  `json:"staff_id" gorm:"column:staff_id"`
	AuthorizedBy *string `json:"authorized_by" gorm:"column:authorized_by"`

	ReturnType   string  `json:"return_type" gorm:"column:return_type"`
	RefundMethod string  `json:"refund_method" gorm:"column:refund_method"`
	RefundAmount float64 `json:"refund_amount" gorm:"column:refund_amount"`

	ReasonCode  string `json:"reason_code" gorm:"column:reason_code"`
	ReasonNotes string `json:"reason_notes" gorm:"column:reason_notes"`

	ReceiptPrinted   bool       `json:"receipt_printed" gorm:"column:receipt_printed"`
	ReceiptPrintedAt *time.Time `json:"receipt_printed_at,omitempty" gorm:"column:receipt_printed_at"`
	ShortCode        *string    `json:"short_code" gorm:"column:short_code"`

	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`

	Items []*ReturnItem `json:"items,omitempty" gorm:"foreignKey:ReturnID"`
}

type ReturnItem struct {
	ID                string  `json:"id" gorm:"primaryKey;column:id"`
	ReturnID          string  `json:"-" gorm:"column:return_id"`
	TransactionItemID string  `json:"transaction_item_id" gorm:"column:transaction_item_id"`
	ProductID         string  `json:"product_id" gorm:"column:product_id"`
	Quantity          int     `json:"quantity" gorm:"column:quantity"`
	UnitPrice         float64 `json:"unit_price" gorm:"column:unit_price"`

	// FALSE untuk barang rusak: uang kembali ke pelanggan, stok TIDAK kembali.
	//
	// Inilah yang membuat retur mustahil direduksi menjadi "transaksi bernilai
	// negatif" — arah uang dan arah barang dapat berbeda. Item ber-Restock
	// false melahirkan baris `product_wastes` di server ([11 §M13.6]).
	Restock         bool    `json:"restock" gorm:"column:restock"`
	WasteReasonCode *string `json:"waste_reason_code,omitempty" gorm:"column:waste_reason_code"`
}

// Validate memeriksa bentuk retur sebelum menyentuh basis data.
//
// Yang TIDAK diperiksa di sini: apakah kuantitas melebihi sisa yang boleh
// diretur. Pemeriksaan itu lintas-baris dan wajib berjalan di dalam transaksi
// basis data dengan `SELECT ... FOR UPDATE` ([11 §3.4]) — memeriksanya di sini
// hanya menghasilkan rasa aman palsu terhadap dua retur yang tiba bersamaan.
func (r *Return) Validate() error {
	if r.OriginalTransactionID == "" {
		return NewSyncFieldError("original_transaction_id", "retur wajib merujuk transaksi asal")
	}
	if r.ReturnType != ReturnTypeFull && r.ReturnType != ReturnTypePartial {
		return NewSyncFieldError("return_type", "jenis retur tidak dikenal: "+r.ReturnType)
	}
	if _, ok := validRefundMethods[r.RefundMethod]; !ok {
		return NewSyncFieldError("refund_method", "metode refund tidak dikenal: "+r.RefundMethod)
	}
	if r.RefundAmount < 0 {
		return NewSyncFieldError("refund_amount", "nominal refund tidak boleh negatif")
	}
	if r.ReasonCode == "" {
		return NewSyncFieldError("reason_code", "alasan retur wajib diisi")
	}
	if len(r.Items) == 0 {
		return NewSyncFieldError("items", "retur tanpa item bukan retur")
	}
	for _, item := range r.Items {
		if item.Quantity <= 0 {
			return NewSyncFieldError("items.quantity", "kuantitas retur harus lebih besar dari nol")
		}
		if item.TransactionItemID == "" {
			return NewSyncFieldError("items.transaction_item_id", "item retur wajib merujuk baris transaksi asal")
		}
		// Barang yang tidak kembali ke stok WAJIB punya alasan pembuangan;
		// tanpa itu, selisih stok muncul tanpa penjelasan saat opname.
		if !item.Restock && (item.WasteReasonCode == nil || *item.WasteReasonCode == "") {
			return NewSyncFieldError("items.waste_reason_code",
				"item yang tidak dikembalikan ke stok wajib menyertakan alasan pembuangan")
		}
	}
	return nil
}

// ReturnableItem adalah satu baris beserta sisa yang masih boleh diretur.
//
// Dipakai endpoint `GET /v1/pos/transactions/{id}/returnable` ([11 §4.5]) dan
// oleh mesin aturan di dalam `ReturnService`.
type ReturnableItem struct {
	TransactionItemID string `json:"transaction_item_id"`
	ProductID         string `json:"product_id"`
	OriginalQuantity  int    `json:"original_quantity"`
	AlreadyReturned   int    `json:"already_returned"`
	// Returnable = OriginalQuantity − AlreadyReturned. Tidak pernah negatif.
	Returnable int     `json:"returnable"`
	UnitPrice  float64 `json:"unit_price"`
}

// ReturnableResponse adalah bentuk kawat endpoint `returnable`.
type ReturnableResponse struct {
	TransactionID string `json:"transaction_id"`
	ReturnState   string `json:"return_state"`
	// `false` bila transaksi belum tercetak — jalurnya Void, bukan Retur.
	Eligible bool              `json:"eligible"`
	Reason   string            `json:"reason,omitempty"`
	Items    []*ReturnableItem `json:"items"`
}

// ReturnSnapshot adalah hasil SATU kali penguncian atas item transaksi asal.
//
// Menggabungkan kuantitas asal dan kuantitas yang sudah diretur ke dalam satu
// pembacaan bukan penghematan kueri, melainkan penghapusan kelas bug: dua
// pembacaan terpisah dapat melihat keadaan yang berbeda bila ada yang menyisip
// di antaranya, dan hasilnya adalah batas retur yang salah.
type ReturnSnapshot struct {
	Items []*ReturnableItem
}

// ByItemID mengindeks isi snapshot agar pemeriksaan per-baris `O(1)`.
func (s *ReturnSnapshot) ByItemID() map[string]*ReturnableItem {
	out := make(map[string]*ReturnableItem, len(s.Items))
	for _, item := range s.Items {
		out[item.TransactionItemID] = item
	}
	return out
}

// IsFullyReturned bernilai true bila SETIAP baris sudah habis diretur.
func (s *ReturnSnapshot) IsFullyReturned() bool {
	if len(s.Items) == 0 {
		return false
	}
	for _, item := range s.Items {
		if item.Returnable > 0 {
			return false
		}
	}
	return true
}

// HasAnyReturn bernilai true bila setidaknya satu baris pernah diretur.
func (s *ReturnSnapshot) HasAnyReturn() bool {
	for _, item := range s.Items {
		if item.AlreadyReturned > 0 {
			return true
		}
	}
	return false
}

// DeriveReturnState menghitung `transactions.return_state` dari snapshot.
//
// **Dihitung server, selalu.** Nilai yang dikirim klien hanya cache tampilan;
// perangkat yang belum menerima retur dari perangkat lain akan mengirim `NONE`
// untuk transaksi yang sebenarnya sudah diretur separuh.
func (s *ReturnSnapshot) DeriveReturnState() string {
	switch {
	case s.IsFullyReturned():
		return ReturnStateFull
	case s.HasAnyReturn():
		return ReturnStatePartial
	default:
		return ReturnStateNone
	}
}

type ReturnRepository interface {
	// Save bersifat DO NOTHING pada konflik id, BUKAN DO UPDATE: retur yang
	// sudah tercatat tidak boleh ditimpa pengiriman ulang yang membawa nilai
	// berbeda akibat jam perangkat mundur ([11 §4.8]).
	Save(ctx context.Context, ret *Return) error
	GetByID(ctx context.Context, id string) (*Return, error)
	ListByOriginalTransaction(ctx context.Context, transactionID string) ([]*Return, error)

	// SnapshotForReturn MENGUNCI baris `transaction_items` milik transaksi asal
	// (`SELECT … FOR UPDATE`) lalu mengembalikan kuantitas asal beserta yang
	// sudah diretur ([11 §3.4]).
	//
	// ⚠️ **Wajib dipanggil di dalam transaksi basis data.** Di luar transaksi,
	// kuncinya dilepas begitu kueri selesai dan seluruh perlindungannya hilang —
	// dua retur bersamaan akan sama-sama lolos.
	SnapshotForReturn(ctx context.Context, transactionID string) (*ReturnSnapshot, error)

	// UpdateReturnState menuliskan kembali agregat ke baris transaksi asal.
	//
	// Diletakkan di repositori RETUR, bukan `POSRepository`, karena nilainya
	// diturunkan sepenuhnya dari tabel `returns` — pemilik data yang menghitung
	// turunannya sendiri tidak dapat menjadi tidak konsisten dengan dirinya.
	UpdateReturnState(ctx context.Context, transactionID, state string) error
}

// ReturnService menegakkan seluruh aturan retur ([11 §M13.6]).
type ReturnService interface {
	// Create menyimpan retur beserta seluruh akibatnya dalam SATU transaksi
	// basis data: validasi agregat, pergerakan stok, penulisan `product_wastes`
	// untuk item yang tidak kembali ke stok, dan perhitungan ulang
	// `transactions.return_state`.
	Create(ctx context.Context, businessID, outletID string, ret *Return) error

	// Returnable melaporkan sisa yang masih boleh diretur per baris.
	Returnable(ctx context.Context, outletID, transactionID string) (*ReturnableResponse, error)
}

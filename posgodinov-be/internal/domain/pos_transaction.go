package domain

import (
	"context"
	"time"
)

// Status shift. Nilainya adalah kontrak lintas platform — string yang sama
// dikirim Web PWA dan Flutter, dan indeks unik parsial `uq_shift_open_per_*`
// mencocokkannya secara harfiah.
const (
	ShiftStatusOpen   = "OPEN"
	ShiftStatusClosed = "CLOSED"
)

// LegacyDeviceID menandai baris yang lahir SEBELUM butir 12 ada.
//
// Dipakai sebagai pembebasan pada `ck_shift_master_version` dan pada gerbang
// master data di lapisan layanan. Nilainya harus sama persis dengan DEFAULT
// kolom `shifts.device_id` pada migrasi 000021 — kalau tidak, seluruh shift v1
// akan ditolak gerbang yang tidak pernah dimaksudkan untuk mereka.
const LegacyDeviceID = "legacy"

type Shift struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id"`
	OutletID       string    `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID     string    `json:"business_id" gorm:"column:business_id"`
	StaffID        string    `json:"staff_id" gorm:"column:staff_id"`
	OpeningBalance float64   `json:"opening_balance" gorm:"column:opening_balance"`
	ClosingBalance float64   `json:"closing_balance" gorm:"column:closing_balance"`
	ExpectedBalance float64  `json:"expected_balance" gorm:"column:expected_balance"`
	Discrepancy    float64   `json:"discrepancy" gorm:"column:discrepancy"`
	Status         string    `json:"status" gorm:"column:status"` // OPEN, CLOSED
	ClientOpenedAt time.Time  `json:"client_opened_at,omitzero" gorm:"column:client_opened_at"`
	ClientClosedAt *time.Time `json:"client_closed_at,omitempty" gorm:"column:client_closed_at"`
	CreatedAt      time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`

	// ── v2 · Blind Closing (butir 9) ────────────────────────────────────────
	//
	// Tiga angka yang BOLEH datang dari kasir. Tidak ada yang keempat.
	DeclaredCash      float64 `json:"declared_cash" gorm:"column:declared_cash"`
	DeclaredEDCTotal  float64 `json:"declared_edc_total" gorm:"column:declared_edc_total"`
	DeclaredQRISTotal float64 `json:"declared_qris_total" gorm:"column:declared_qris_total"`
	BlindClose        bool    `json:"blind_close" gorm:"column:blind_close"`

	// ── v2 · Rekonsiliasi — DIHITUNG SERVER (aturan R3 & R4) ────────────────
	//
	// ⚠️ `json:"-"` DISENGAJA DAN MENGIKAT. Satu tag ini menegakkan DUA aturan
	// sekaligus:
	//
	//   R3 — nilai ini tidak pernah SAMPAI ke perangkat kasir. Kolom yang tidak
	//        diserialisasi tidak bisa bocor lewat DevTools atau `adb logcat`,
	//        dan tidak ada yang perlu ingat menyaringnya di setiap endpoint.
	//   R4 — nilai ini tidak pernah DITERIMA dari perangkat. Dekoder JSON
	//        membuang kunci `expected_cash` sebelum sempat dibaca, sehingga
	//        klien yang dimodifikasi tidak dapat menentukan selisih kasnya
	//        sendiri.
	//
	// Layar rekonsiliasi pemilik memakai DTO tersendiri ([11 §4.5]), bukan
	// struct ini.
	ExpectedCash      *float64   `json:"-" gorm:"column:expected_cash"`
	ExpectedEDCTotal  *float64   `json:"-" gorm:"column:expected_edc_total"`
	ExpectedQRISTotal *float64   `json:"-" gorm:"column:expected_qris_total"`
	CashVariance      *float64   `json:"-" gorm:"column:cash_variance"`
	EDCVariance       *float64   `json:"-" gorm:"column:edc_variance"`
	QRISVariance      *float64   `json:"-" gorm:"column:qris_variance"`
	ReconciledAt      *time.Time `json:"-" gorm:"column:reconciled_at"`

	ClosedBy *string `json:"closed_by" gorm:"column:closed_by"`

	// ── v2 · Gerbang & penguncian sesi (butir 10 & 12) ──────────────────────
	MasterDataVersion *int64 `json:"master_data_version" gorm:"column:master_data_version"`
	DeviceID          string `json:"device_id" gorm:"column:device_id"`
}

type Transaction struct {
	ID              string             `json:"id" gorm:"primaryKey;column:id"`
	ShiftID         string             `json:"shift_id" gorm:"column:shift_id"`
	OutletID        string             `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID      string             `json:"business_id" gorm:"column:business_id"`
	CustomerName    string             `json:"customer_name" gorm:"column:customer_name"`
	TotalAmount     float64            `json:"total_amount" gorm:"column:total_amount"`
	PaymentMethod   string             `json:"payment_method" gorm:"column:payment_method"`
	Status          string             `json:"status" gorm:"column:status"` // COMPLETED, CANCELLED
	CancelNotes     string             `json:"cancel_notes" gorm:"column:cancel_notes"`
	ClientCreatedAt time.Time          `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time          `json:"created_at,omitzero" gorm:"column:created_at"`
	Items           []*TransactionItem `json:"items,omitempty" gorm:"foreignKey:TransactionID"`

	// ── v2 · Multi-tender (butir 8) ─────────────────────────────────────────
	//
	// Sumber kebenaran pembayaran. `PaymentMethod` di atas turun pangkat
	// menjadi ringkasan v1-compat, bernilai `SPLIT` bila tender lebih dari satu.
	Payments []*TransactionPayment `json:"payments,omitempty" gorm:"foreignKey:TransactionID"`

	TenderCount        int     `json:"tender_count" gorm:"column:tender_count"`
	CashAmount         float64 `json:"cash_amount" gorm:"column:cash_amount"`
	NonCashAmount      float64 `json:"noncash_amount" gorm:"column:noncash_amount"`
	PrimaryTraceNumber *string `json:"primary_trace_number" gorm:"column:primary_trace_number"`
	PrimaryCardLast4   *string `json:"primary_card_last4" gorm:"column:primary_card_last4"`

	// ── v2 · DISKRIMINATOR VOID vs RETUR (butir 15, [11 §2.1]) ──────────────
	//
	// nil  = struk belum pernah terbit  → wilayah VOID
	// terisi = dokumen sudah berpindah ke pelanggan → wilayah RETUR
	ReceiptPrintedAt *time.Time `json:"receipt_printed_at" gorm:"column:receipt_printed_at"`
	ReprintCount     int        `json:"reprint_count" gorm:"column:reprint_count"`

	// ── v2 · Pencarian lintas shift (butir 16) ──────────────────────────────
	ShortCode *string `json:"short_code" gorm:"column:short_code"`

	// Agregat retur — DIHITUNG SERVER dari tabel `returns`. Klien boleh
	// mengirimnya; server menimpanya.
	ReturnState string `json:"return_state" gorm:"column:return_state"`

	DeviceID       string     `json:"device_id" gorm:"column:device_id"`
	VoidedAt       *time.Time `json:"voided_at" gorm:"column:voided_at"`
	VoidedBy       *string    `json:"voided_by" gorm:"column:voided_by"`
	VoidReasonCode *string    `json:"void_reason_code" gorm:"column:void_reason_code"`
}

// Status transaksi. `CANCELLED` adalah nilai WARISAN v1 yang sengaja tetap
// diterima: perangkat lapangan yang mati dua minggu akan kembali membawa
// antrean berisi nilai lama, dan menolaknya berarti membuang pembatalan yang
// benar-benar terjadi ([11 §2.1]).
const (
	TxStatusCompleted = "COMPLETED"
	TxStatusVoided    = "VOIDED"
	TxStatusCancelled = "CANCELLED"
)

// IsCancellation berlaku untuk VOIDED maupun CANCELLED.
//
// Setiap tempat yang bertanya "apakah transaksi ini batal" WAJIB memakai fungsi
// ini. Membandingkan langsung dengan satu nilai akan membuat transaksi ter-void
// terhitung sebagai penjualan — selisih kas yang harus dipertanggungjawabkan
// kasir di akhir shift ([11 §2.4]).
func IsCancellation(status string) bool {
	return status == TxStatusVoided || status == TxStatusCancelled
}

// SumTenders menjumlahkan seluruh baris tender.
func (t *Transaction) SumTenders() float64 {
	var total float64
	for _, p := range t.Payments {
		total += p.Amount
	}
	return total
}

// ResolvePayments mengembalikan rincian tender beserta penanda apakah ia
// disintesis dari `payment_method` alih-alih dikirim perangkat.
//
// Klien v1 tidak mengirim `payments` sama sekali. Merekonstruksinya di sini
// menjaga invarian `Σ payments = total_amount` berlaku untuk SETIAP transaksi,
// berapa pun umurnya — sehingga lapisan penyimpanan tidak perlu mengenal dua
// bentuk data.
//
// `id` sengaja memakai ulang UUID transaksi: deterministik, sehingga pengiriman
// ulang tidak menyisipkan tender ganda (aturan R2).
//
// Mengembalikan `(nil, false)` bila rekonstruksi tidak mungkin. Itu BUKAN galat:
// transaksi bernilai nol dan `SPLIT` tanpa rincian memang tidak memiliki tender
// yang dapat disimpulkan, dan mengarangnya berarti memalsukan bukti audit.
// Pemanggil menyimpan transaksinya tanpa baris tender.
func (t *Transaction) ResolvePayments() (payments []*TransactionPayment, synthesized bool) {
	if len(t.Payments) > 0 {
		return t.Payments, false
	}
	if t.PaymentMethod == PaymentSummarySplit || t.TotalAmount <= 0 {
		return nil, false
	}
	if _, ok := ValidTenderMethods[t.PaymentMethod]; !ok {
		return nil, false
	}
	return []*TransactionPayment{{
		ID:              t.ID,
		TransactionID:   t.ID,
		Sequence:        1,
		Method:          t.PaymentMethod,
		Amount:          t.TotalAmount,
		IsReconstructed: true,
	}}, true
}

type TransactionItem struct {
	ID            string  `json:"id" gorm:"primaryKey;column:id"`
	TransactionID string  `json:"transaction_id" gorm:"column:transaction_id"`
	ProductID     string  `json:"product_id" gorm:"column:product_id"`
	Quantity      int     `json:"quantity" gorm:"column:quantity"`
	UnitPrice     float64 `json:"unit_price" gorm:"column:unit_price"`
}

type ProductWaste struct {
	ID              string    `json:"id" gorm:"primaryKey;column:id"`
	OutletID        string    `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID      string    `json:"business_id" gorm:"column:business_id"`
	StaffID         string    `json:"staff_id" gorm:"column:staff_id"`
	ProductID       string    `json:"product_id" gorm:"column:product_id"`
	Quantity        int       `json:"quantity" gorm:"column:quantity"`
	Reason          string    `json:"reason" gorm:"column:reason"`
	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`

	// ── v2 · butir 7 ([11 §3.2] migrasi 000023) ─────────────────────────────
	//
	// Kolomnya ditambahkan pada M11.1, tetapi field Go-nya baru dibutuhkan di
	// M13.6 — retur ber-`restock=false` menulis baris waste turunan yang WAJIB
	// membawa `reason_code`. Tanpa field ini GORM tidak akan menuliskannya, dan
	// baris turunannya jatuh ke nilai bawaan `'OTHER'` yang tidak menjelaskan
	// apa pun.
	ReasonCode string  `json:"reason_code" gorm:"column:reason_code"`
	ShiftID    *string `json:"shift_id" gorm:"column:shift_id"`
	DeviceID   string  `json:"device_id" gorm:"column:device_id"`

	// Bukti struk pembuangan terbit. Baris turunan retur SENGAJA `false`:
	// struk retur sudah memuat item yang sama, dan dua kertas untuk satu
	// peristiwa hanya menambah kebingungan saat rekonsiliasi.
	ReceiptPrinted bool       `json:"receipt_printed" gorm:"column:receipt_printed"`
	PrintedAt      *time.Time `json:"printed_at,omitempty" gorm:"column:printed_at"`
}

// Repositories
type POSRepository interface {
	SaveShift(ctx context.Context, shift *Shift) error
	GetShiftByID(ctx context.Context, id string) (*Shift, error)
	
	SaveTransaction(ctx context.Context, trx *Transaction) error
	GetTransactionByID(ctx context.Context, id string) (*Transaction, error)

	// LookupTransaction mencari SATU transaksi lewat kode struk atau UUID —
	// butir 16 ([11 §M17.3]).
	//
	// Dibatasi pada satu outlet: kasir yang mengetik kode milik cabang lain
	// tidak boleh menemukannya. Mengembalikan galat "tidak ditemukan" yang sama
	// untuk kode yang tidak ada dan kode milik outlet lain — membedakannya akan
	// membocorkan keberadaan transaksi cabang lain lewat pesan galat.
	LookupTransaction(ctx context.Context, outletID, code string) (*Transaction, error)
	GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*Transaction, error)
	UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error
	
	SaveProductWaste(ctx context.Context, waste *ProductWaste) error
	GetProductWasteByID(ctx context.Context, id string) (*ProductWaste, error)
}

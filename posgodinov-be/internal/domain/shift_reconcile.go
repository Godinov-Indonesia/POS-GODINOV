package domain

import (
	"context"
	"time"
)

// ShiftTenderTotals adalah rekapitulasi satu shift menurut CATATAN SERVER.
//
// Angka-angka ini tidak pernah berasal dari perangkat kasir. Seluruhnya
// dijumlahkan ulang dari `transaction_payments` dan `returns` pada saat
// rekonsiliasi — lihat catatan pada ShiftReconcileService.
type ShiftTenderTotals struct {
	// Σ tender per kelompok, dari transaksi berstatus COMPLETED.
	CashIn     float64
	EDCIn      float64
	QRISIn     float64
	TransferIn float64

	// Σ refund yang benar-benar mengurangi kelompok yang sama.
	CashRefund float64
	EDCRefund  float64
	QRISRefund float64
}

// ShiftReconcileRepository membaca agregat yang dibutuhkan rekonsiliasi.
//
// Dipisah dari POSRepository dengan sengaja: seluruh metodenya hanya membaca,
// dan memisahkannya membuat jelas bahwa rekonsiliasi tidak pernah menulis ke
// tabel transaksi.
type ShiftReconcileRepository interface {
	// TenderTotalsOfShift menjumlahkan tender dan refund satu shift.
	TenderTotalsOfShift(ctx context.Context, shiftID string) (*ShiftTenderTotals, error)

	// UpdateShiftReconciliation menulis HANYA kolom ekspektasi dan selisih.
	//
	// Tidak menyentuh `declared_*`: angka deklarasi adalah kesaksian kasir, dan
	// satu-satunya penulisnya adalah jalur sinkronisasi.
	UpdateShiftReconciliation(ctx context.Context, r *ShiftReconciliation) error

	// ListReconciliation membaca baris untuk layar pemilik.
	ListReconciliation(ctx context.Context, f ShiftReconciliationFilter) ([]*ShiftReconciliationRow, error)
}

// ShiftReconciliation adalah hasil hitung server untuk satu shift.
//
// ⚠️ Tidak memiliki tag `json` sama sekali, dan itu disengaja. Struct ini tidak
// pernah diserialisasi ke perangkat kasir (aturan R3); layar rekonsiliasi
// pemilik memakai DTO tersendiri yang hidup di lapisan handler.
type ShiftReconciliation struct {
	ShiftID string

	ExpectedCash      float64
	ExpectedEDCTotal  float64
	ExpectedQRISTotal float64

	CashVariance float64
	EDCVariance  float64
	QRISVariance float64

	ReconciledAt time.Time
}

// ShiftReconcileService menghitung ekspektasi kas sebuah shift yang sudah
// ditutup — butir 9 ([11 §M15.3]).
//
// ═══════════════════════════════════════════════════════════════════════════
// MENGAPA PERHITUNGAN INI PINDAH KE SERVER
// ═══════════════════════════════════════════════════════════════════════════
//
// Pada v1, `expected_balance` dan `discrepancy` dihitung di perangkat kasir,
// lalu dikirim apa adanya. Artinya orang yang paling berkepentingan agar
// selisihnya nol adalah orang yang menghitungnya. Blind Closing menutup lubang
// itu dari dua arah sekaligus:
//
//  1. Kasir tidak pernah MELIHAT ekspektasi, sehingga angka deklarasinya
//     benar-benar kesaksian atas isi laci — bukan angka yang dicocokkan.
//  2. Server tidak pernah MENERIMA ekspektasi, sehingga klien yang dimodifikasi
//     tidak dapat menentukan selisihnya sendiri.
//
// Keduanya diperlukan. Menyembunyikan angka di UI saja masih menyisakan
// endpoint yang menerima `expected_cash` dari siapa pun yang bisa mengirim
// HTTP.
type ShiftReconcileService interface {
	// Reconcile menghitung dan menyimpan ekspektasi untuk satu shift.
	//
	// Aman dipanggil berulang: hasilnya hanya bergantung pada isi basis data,
	// sehingga pengiriman ulang shift yang sama menghasilkan angka yang sama.
	Reconcile(ctx context.Context, shiftID string) (*ShiftReconciliation, error)

	// List menyusun layar Rekonsiliasi Shift milik pemilik.
	List(ctx context.Context, f ShiftReconciliationFilter) ([]*ShiftReconciliationRow, error)
}

// ShiftReconciliationRow adalah satu baris pada layar Rekonsiliasi Shift milik
// pemilik ([11 §M15.3]).
//
// ⚠️ DTO TERSENDIRI, DAN ITU BUKAN KEBETULAN.
//
// Struct `Shift` tidak dapat dipakai di sini: kolom `expected_*` dan
// `*_variance` di sana bertag `json:"-"` justru supaya tidak pernah bocor ke
// perangkat kasir (aturan R3). Membuka tag itu demi layar pemilik akan
// membatalkan penegakan tersebut untuk SETIAP endpoint sekaligus.
//
// Pemisahan ini juga yang membuat perbedaannya tegas: rute perangkat memakai
// `Shift`, rute pemilik memakai struct ini, dan tidak ada satu pun jalur yang
// dapat tertukar tanpa gagal saat kompilasi.
type ShiftReconciliationRow struct {
	ShiftID   string `json:"shift_id"`
	StaffID   string `json:"staff_id"`
	StaffName string `json:"staff_name"`
	DeviceID  string `json:"device_id"`
	Status    string `json:"status"`

	OpeningBalance float64 `json:"opening_balance"`

	// Kesaksian kasir.
	DeclaredCash      float64 `json:"declared_cash"`
	DeclaredEDCTotal  float64 `json:"declared_edc_total"`
	DeclaredQRISTotal float64 `json:"declared_qris_total"`
	BlindClose        bool    `json:"blind_close"`

	// Hitungan server. Nil selama shift belum direkonsiliasi.
	ExpectedCash      *float64 `json:"expected_cash"`
	ExpectedEDCTotal  *float64 `json:"expected_edc_total"`
	ExpectedQRISTotal *float64 `json:"expected_qris_total"`
	CashVariance      *float64 `json:"cash_variance"`
	EDCVariance       *float64 `json:"edc_variance"`
	QRISVariance      *float64 `json:"qris_variance"`

	// Penanda selisih melebihi ambang — dihitung server supaya ketiga klien
	// tidak masing-masing menafsirkan ambangnya sendiri.
	Flagged           bool    `json:"flagged"`
	VarianceThreshold float64 `json:"variance_threshold"`

	ClientOpenedAt time.Time  `json:"client_opened_at"`
	ClientClosedAt *time.Time `json:"client_closed_at"`
	ReconciledAt   *time.Time `json:"reconciled_at"`
}

// ShiftReconciliationFilter membatasi rentang layar rekonsiliasi.
type ShiftReconciliationFilter struct {
	BusinessID string
	OutletID   string
	StartDate  string
	EndDate    string
}

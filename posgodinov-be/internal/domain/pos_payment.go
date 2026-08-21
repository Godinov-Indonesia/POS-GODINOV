package domain

import (
	"context"
	"time"
)

// Nilai sah untuk `transaction_payments.method` — KONTRAK BEKU, wajib identik
// dengan `TENDER_METHODS` di Web dan `TenderMethod` di Flutter ([11 §3.5]).
const (
	TenderCash     = "CASH"
	TenderQRIS     = "QRIS"
	TenderDebit    = "DEBIT"
	TenderCredit   = "CREDIT"
	TenderTransfer = "TRANSFER"

	// PaymentSummarySplit HANYA sah di `transactions.payment_method`, tidak
	// pernah di `transaction_payments.method`. Ia adalah ringkasan atas dua
	// tender atau lebih, bukan cara membayar.
	PaymentSummarySplit = "SPLIT"
)

// ValidTenderMethods adalah himpunan tender yang diterima server.
var ValidTenderMethods = map[string]struct{}{
	TenderCash:     {},
	TenderQRIS:     {},
	TenderDebit:    {},
	TenderCredit:   {},
	TenderTransfer: {},
}

// IsCardTender menandai tender yang WAJIB membawa trace number dan 4 digit
// akhir kartu (butir 8). Cerminan `CHECK ck_card_requires_trace`.
func IsCardTender(method string) bool {
	return method == TenderDebit || method == TenderCredit
}

// TransactionPayment adalah satu baris tender — butir 8 ([11 §3.2]).
//
// # Larangan keras (aturan R8)
//
// ⛔ Struct ini TIDAK BOLEH menumbuhkan field untuk nomor kartu penuh (PAN),
// CVV, PIN kartu, atau data magstripe. Menyimpannya memindahkan seluruh sistem
// ke ruang lingkup PCI-DSS penuh. Hanya empat digit terakhir dan trace number
// yang boleh hidup di sini.
type TransactionPayment struct {
	ID            string  `json:"id" gorm:"primaryKey;column:id"`
	TransactionID string  `json:"-" gorm:"column:transaction_id"`
	Sequence      int     `json:"sequence" gorm:"column:sequence"`
	Method        string  `json:"method" gorm:"column:method"`
	Amount        float64 `json:"amount" gorm:"column:amount"`

	// Wajib untuk DEBIT/CREDIT.
	TraceNumber *string `json:"trace_number,omitempty" gorm:"column:trace_number"`
	CardLast4   *string `json:"card_last4,omitempty" gorm:"column:card_last4"`

	CardNetwork   *string `json:"card_network,omitempty" gorm:"column:card_network"`
	ApprovalCode  *string `json:"approval_code,omitempty" gorm:"column:approval_code"`
	EDCTerminalID *string `json:"edc_terminal_id,omitempty" gorm:"column:edc_terminal_id"`

	// Baris ini adalah REKONSTRUKSI, bukan kesaksian perangkat.
	//
	// Dua sumber mengisinya: migrasi 000024 untuk transaksi pra-v2, dan jalur
	// sinkronisasi v1 yang masih hidup selama jendela deprekasi. Klien v1
	// mengirim `payment_method: "DEBIT"` tanpa trace number sama sekali —
	// kolomnya memang belum ada saat ia dirilis — sehingga tender yang
	// disintesis darinya tidak dapat, dan tidak boleh, dituntut memenuhi
	// butir 8.
	//
	// ⚠️ `json:"-"` DISENGAJA DAN MENGIKAT. Ini satu-satunya pengecualian
	// `ck_card_requires_trace`; bila klien dapat mengisinya, siapa pun bisa
	// mengirim tender kartu tanpa trace number hanya dengan menambahkan satu
	// field, dan butir 8 runtuh. Dekoder JSON membuangnya sebelum dibaca.
	IsReconstructed bool `json:"-" gorm:"column:is_reconstructed"`

	CreatedAt time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

// Validate menegakkan invarian satu baris tender sebelum menyentuh basis data.
//
// Basis data tetap menjadi penegak terakhir lewat CHECK constraint; pemeriksaan
// di sini mengubah galat Postgres yang mentah menjadi pesan yang dapat
// ditindaklanjuti kasir, dan menahannya sebelum transaksi basis data dibuka.
func (p *TransactionPayment) Validate() error {
	if _, ok := ValidTenderMethods[p.Method]; !ok {
		return NewSyncFieldError("method", "metode tender di luar kontrak beku: "+p.Method)
	}
	if p.Amount <= 0 {
		return NewSyncFieldError("amount", "nominal tender harus lebih besar dari nol")
	}
	// Tender hasil rekonstruksi dikecualikan dari butir 8 — lihat
	// [IsReconstructed]. Menuntut trace number pada baris yang informasinya
	// memang tidak pernah ada berarti menolak penjualan nyata yang uangnya
	// sudah diterima.
	if p.IsReconstructed || !IsCardTender(p.Method) {
		return nil
	}
	if p.TraceNumber == nil || *p.TraceNumber == "" {
		return NewSyncFieldError("trace_number", "pembayaran kartu wajib menyertakan trace number")
	}
	if p.CardLast4 == nil || len(*p.CardLast4) != 4 {
		return NewSyncFieldError("card_last4", "pembayaran kartu wajib menyertakan 4 digit akhir kartu")
	}
	for _, r := range *p.CardLast4 {
		if r < '0' || r > '9' {
			return NewSyncFieldError("card_last4", "4 digit akhir kartu harus berupa angka")
		}
	}
	return nil
}

// TenderSummary adalah nilai terdenormalisasi yang diturunkan dari baris tender
// lalu dituliskan kembali ke `transactions` demi kompatibilitas laporan v1.
//
// Ia BUKAN sumber kebenaran — `transaction_payments` yang berwenang. Kolom
// ringkasan ada semata agar kueri laporan lama tidak perlu melakukan JOIN yang
// belum pernah ada di v1.
type TenderSummary struct {
	TenderCount        int
	PaymentMethod      string
	CashAmount         float64
	NonCashAmount      float64
	PrimaryTraceNumber *string
	PrimaryCardLast4   *string
}

type TransactionPaymentRepository interface {
	SaveMany(ctx context.Context, payments []*TransactionPayment) error
	GetByTransactionID(ctx context.Context, transactionID string) ([]*TransactionPayment, error)

	// UpdateSummary menuliskan kembali ringkasan ke baris induk.
	//
	// Diletakkan di repositori tender, BUKAN di POSRepository, karena nilainya
	// diturunkan sepenuhnya dari tabel tender — pemilik data yang menghitung
	// ringkasannya sendiri tidak dapat menjadi tidak konsisten dengan dirinya.
	UpdateSummary(ctx context.Context, transactionID string, sum TenderSummary) error
}

package service

import (
	"context"
	"errors"
	"time"

	"posgodinov-backend/internal/domain"
)

type shiftReconcileService struct {
	posRepo       domain.POSRepository
	reconcileRepo domain.ShiftReconcileRepository
	now           func() time.Time
}

// NewShiftReconcileService merakit layanan rekonsiliasi shift ([11 §M15.3]).
func NewShiftReconcileService(
	posRepo domain.POSRepository,
	reconcileRepo domain.ShiftReconcileRepository,
) domain.ShiftReconcileService {
	return &shiftReconcileService{
		posRepo:       posRepo,
		reconcileRepo: reconcileRepo,
		now:           time.Now,
	}
}

// Reconcile menghitung ekspektasi kas satu shift dan menyimpannya.
//
// ═══════════════════════════════════════════════════════════════════════════
// RUMUS, DAN MENGAPA SETIAP SUKUNYA ADA
// ═══════════════════════════════════════════════════════════════════════════
//
//	expected_cash       = opening_balance
//	                    + Σ transaction_payments(CASH) pada transaksi COMPLETED
//	                    − Σ returns.refund_amount bermetode CASH
//
//	expected_edc_total  = Σ tender DEBIT + CREDIT − Σ refund CARD_REVERSAL
//	expected_qris_total = Σ tender QRIS            − Σ refund QRIS_REVERSAL
//
// Sumbernya `transaction_payments`, BUKAN `transactions.payment_method`.
// Kolom itu turun pangkat menjadi ringkasan v1-compat sejak butir 8, dan
// bernilai `SPLIT` untuk transaksi multi-tender — menjumlahkan `total_amount`
// berdasarkan kolom tersebut akan memasukkan seluruh nilai transaksi split ke
// satu kelompok, dan menghasilkan selisih yang harus dipertanggungjawabkan
// kasir atas uang yang tidak pernah ada di lacinya.
//
// Refund `EXCHANGE` dan `STORE_CREDIT` sengaja TIDAK dikurangkan di mana pun:
// keduanya tidak memindahkan uang. Barang ditukar barang, atau nilainya
// disimpan sebagai kredit — laci tidak berubah, dan mesin EDC tidak menerbitkan
// pembatalan. Mengurangkannya akan membuat kasir tampak kekurangan uang persis
// sebesar nilai barang yang ia tukar dengan benar.
func (s *shiftReconcileService) Reconcile(ctx context.Context, shiftID string) (*domain.ShiftReconciliation, error) {
	if shiftID == "" {
		return nil, errors.New("shift id kosong")
	}

	shift, err := s.posRepo.GetShiftByID(ctx, shiftID)
	if err != nil {
		return nil, err
	}

	totals, err := s.reconcileRepo.TenderTotalsOfShift(ctx, shiftID)
	if err != nil {
		return nil, err
	}

	expectedCash := shift.OpeningBalance + totals.CashIn - totals.CashRefund
	expectedEDC := totals.EDCIn - totals.EDCRefund
	expectedQRIS := totals.QRISIn - totals.QRISRefund

	// Selisih = yang DIDEKLARASIKAN − yang SEHARUSNYA.
	//
	// Negatif berarti uangnya kurang. Arah ini dipilih supaya tandanya terbaca
	// sama seperti pada laporan v1, sehingga laporan pemilik yang sudah ada
	// tidak berubah arti di tengah jendela deprekasi.
	result := &domain.ShiftReconciliation{
		ShiftID:           shiftID,
		ExpectedCash:      round2(expectedCash),
		ExpectedEDCTotal:  round2(expectedEDC),
		ExpectedQRISTotal: round2(expectedQRIS),
		CashVariance:      round2(shift.DeclaredCash - expectedCash),
		EDCVariance:       round2(shift.DeclaredEDCTotal - expectedEDC),
		QRISVariance:      round2(shift.DeclaredQRISTotal - expectedQRIS),
		ReconciledAt:      s.now().UTC(),
	}

	if err := s.reconcileRepo.UpdateShiftReconciliation(ctx, result); err != nil {
		return nil, err
	}

	return result, nil
}

// round2 membulatkan ke dua desimal.
//
// Kolomnya `DECIMAL(15,2)`, sedangkan penjumlahan di atas berjalan pada
// `float64`. Tanpa pembulatan, sisa biner sekecil 1e-13 tetap tersimpan sebagai
// selisih bukan-nol, dan laporan pemilik akan menampilkan "selisih kas" pada
// shift yang sebenarnya pas.
func round2(v float64) float64 {
	const scale = 100
	if v < 0 {
		return float64(int64(v*scale-0.5)) / scale
	}
	return float64(int64(v*scale+0.5)) / scale
}

// VarianceThreshold adalah ambang selisih yang menandai satu shift untuk
// ditinjau pemilik.
//
// Rp 5.000 dipilih karena berada di atas kebisingan wajar — pembulatan uang
// receh, satu kembalian yang salah hitung — dan di bawah nilai yang layak
// diselidiki. Ambang nol akan menandai hampir setiap shift dan membuat
// penandaannya berhenti berarti apa pun dalam sepekan.
//
// Dihitung SERVER, bukan tiga klien. Ambang yang ditafsirkan masing-masing
// aplikasi akan membuat satu shift tampak bermasalah di dashboard dan normal di
// laporan cetak.
const VarianceThreshold = 5000.0

// List menyusun layar Rekonsiliasi Shift milik pemilik ([11 §M15.3]).
//
// Penandaan dilakukan di sini, bukan di SQL: aturannya adalah kebijakan bisnis,
// dan menaruhnya di kueri menyebarkannya ke tempat yang tidak dapat diuji tanpa
// basis data.
func (s *shiftReconcileService) List(ctx context.Context, f domain.ShiftReconciliationFilter) ([]*domain.ShiftReconciliationRow, error) {
	rows, err := s.reconcileRepo.ListReconciliation(ctx, f)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		row.VarianceThreshold = VarianceThreshold
		row.Flagged = exceeds(row.CashVariance) ||
			exceeds(row.EDCVariance) ||
			exceeds(row.QRISVariance)
	}

	return rows, nil
}

// exceeds menilai satu selisih terhadap ambang.
//
// Nil berarti shift-nya belum direkonsiliasi — bukan berarti selisihnya nol.
// Menganggapnya nol akan menampilkan shift yang belum dihitung sebagai "aman",
// yang persis kebalikan dari yang benar.
//
// Kedua arah ditandai. Uang yang LEBIH sama pentingnya dengan uang yang kurang:
// laci yang berlebih menandakan transaksi yang tidak tercatat, dan itu adalah
// bentuk kebocoran yang justru tidak pernah dilaporkan siapa pun.
func exceeds(v *float64) bool {
	if v == nil {
		return false
	}
	if *v < 0 {
		return -*v > VarianceThreshold
	}
	return *v > VarianceThreshold
}

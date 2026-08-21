package repository

import (
	"context"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type shiftReconcileRepository struct {
	db *gorm.DB
}

// NewShiftReconcileRepository merakit repositori baca-saja untuk rekonsiliasi
// shift ([11 §M15.3]).
func NewShiftReconcileRepository(db *gorm.DB) domain.ShiftReconcileRepository {
	return &shiftReconcileRepository{db: db}
}

// TenderTotalsOfShift menjumlahkan tender dan refund satu shift.
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU KUERI, BUKAN ENAM
// ═══════════════════════════════════════════════════════════════════════════
//
// Seluruh agregat diambil dalam satu perjalanan ke basis data. Enam kueri
// terpisah bukan hanya lebih lambat: masing-masing melihat snapshot yang
// berbeda, sehingga transaksi yang tersinkron di tengah rangkaian akan terhitung
// pada sebagian agregat saja — dan hasilnya adalah selisih kas yang tidak
// pernah benar-benar terjadi.
//
// `FILTER (WHERE …)` dipilih ketimbang `CASE WHEN`: keduanya setara di
// Postgres, tetapi bentuk ini membuat setiap suku rumus terbaca sebagai satu
// baris yang berdiri sendiri.
func (r *shiftReconcileRepository) TenderTotalsOfShift(ctx context.Context, shiftID string) (*domain.ShiftTenderTotals, error) {
	db := database.GetDB(ctx, r.db)

	var totals domain.ShiftTenderTotals

	// ── Sisi masuk: tender pada transaksi COMPLETED milik shift ini ─────────
	//
	// `JOIN transactions` WAJIB. Tanpanya, tender milik transaksi yang
	// kemudian di-VOID ikut terjumlah, dan kasir dituntut atas uang yang sudah
	// dikembalikan ke pelanggan.
	inRow := struct {
		Cash     float64
		EDC      float64
		QRIS     float64
		Transfer float64
	}{}

	if err := db.WithContext(ctx).
		Raw(`
			SELECT
			  COALESCE(SUM(p.amount) FILTER (WHERE p.method = ?), 0)                  AS cash,
			  COALESCE(SUM(p.amount) FILTER (WHERE p.method IN (?, ?)), 0)            AS edc,
			  COALESCE(SUM(p.amount) FILTER (WHERE p.method = ?), 0)                  AS qris,
			  COALESCE(SUM(p.amount) FILTER (WHERE p.method = ?), 0)                  AS transfer
			FROM transaction_payments p
			JOIN transactions t ON t.id = p.transaction_id
			WHERE t.shift_id = ? AND t.status = ?
		`,
			domain.TenderCash,
			domain.TenderDebit, domain.TenderCredit,
			domain.TenderQRIS,
			domain.TenderTransfer,
			shiftID, domain.TxStatusCompleted,
		).Scan(&inRow).Error; err != nil {
		return nil, err
	}

	// ── Sisi keluar: refund yang terjadi DI SHIFT INI ───────────────────────
	//
	// Difilter `returns.shift_id`, bukan shift transaksi asalnya. Pelanggan
	// yang mengembalikan barang besok mengambil uangnya dari laci kasir HARI
	// INI — membebankannya ke shift kemarin akan membuat kasir kemarin tampak
	// kekurangan uang atas laci yang sudah ia serahkan dan hitung.
	//
	// `EXCHANGE` dan `STORE_CREDIT` tidak muncul di sini karena keduanya tidak
	// memindahkan uang sama sekali.
	outRow := struct {
		Cash float64
		EDC  float64
		QRIS float64
	}{}

	if err := db.WithContext(ctx).
		Raw(`
			SELECT
			  COALESCE(SUM(r.refund_amount) FILTER (WHERE r.refund_method = ?), 0) AS cash,
			  COALESCE(SUM(r.refund_amount) FILTER (WHERE r.refund_method = ?), 0) AS edc,
			  COALESCE(SUM(r.refund_amount) FILTER (WHERE r.refund_method = ?), 0) AS qris
			FROM returns r
			WHERE r.shift_id = ?
		`,
			domain.RefundCash,
			domain.RefundCardReversal,
			domain.RefundQRISReversal,
			shiftID,
		).Scan(&outRow).Error; err != nil {
		return nil, err
	}

	totals.CashIn = inRow.Cash
	totals.EDCIn = inRow.EDC
	totals.QRISIn = inRow.QRIS
	totals.TransferIn = inRow.Transfer
	totals.CashRefund = outRow.Cash
	totals.EDCRefund = outRow.EDC
	totals.QRISRefund = outRow.QRIS

	return &totals, nil
}

// UpdateShiftReconciliation menulis HANYA kolom hasil hitung server.
//
// Daftar kolomnya eksplisit dan pendek dengan sengaja. `Save(&shift)` akan
// menulis seluruh baris, termasuk `declared_*` yang baru saja dikirim kasir —
// dan bila struct-nya kebetulan basi, kesaksian kasir tertimpa oleh salinan
// lama tanpa satu pun galat.
//
// `expected_balance` dan `discrepancy` v1 ikut diisi ganda selama jendela
// deprekasi M18, sesuai COMMENT pada migrasi 000021: laporan pemilik yang lama
// masih membacanya, dan membiarkannya membeku pada angka klien justru
// mempertahankan lubang yang fase ini tutup.
func (r *shiftReconcileRepository) UpdateShiftReconciliation(ctx context.Context, rec *domain.ShiftReconciliation) error {
	db := database.GetDB(ctx, r.db)

	return db.WithContext(ctx).
		Model(&domain.Shift{}).
		Where("id = ?", rec.ShiftID).
		Updates(map[string]any{
			"expected_cash":       rec.ExpectedCash,
			"expected_edc_total":  rec.ExpectedEDCTotal,
			"expected_qris_total": rec.ExpectedQRISTotal,
			"cash_variance":       rec.CashVariance,
			"edc_variance":        rec.EDCVariance,
			"qris_variance":       rec.QRISVariance,
			"reconciled_at":       rec.ReconciledAt,

			// Jendela deprekasi — lihat catatan di atas.
			"expected_balance": rec.ExpectedCash,
			"discrepancy":      rec.CashVariance,
		}).Error
}

// ListReconciliation membaca baris untuk layar Rekonsiliasi Shift pemilik.
//
// Memilih kolom secara EKSPLISIT, bukan `SELECT *` ke dalam `domain.Shift`.
// Dua alasan, dan keduanya mengikat:
//
//  1. `Shift` memberi tag `json:"-"` pada kolom ekspektasi supaya tidak pernah
//     bocor ke perangkat kasir. Memakainya di sini akan memaksa seseorang
//     membuka tag itu, dan penegakan R3 hilang untuk seluruh endpoint.
//  2. Nama kasir hanya ada di tabel `users`. Menjoinnya di sini membuat layar
//     pemilik tidak perlu satu kueri tambahan per baris.
//
// `LEFT JOIN` pada users disengaja: staff yang sudah dihapus tidak boleh
// membuat shift-nya lenyap dari laporan — justru shift milik orang yang sudah
// tidak ada yang paling perlu dilihat.
func (r *shiftReconcileRepository) ListReconciliation(ctx context.Context, f domain.ShiftReconciliationFilter) ([]*domain.ShiftReconciliationRow, error) {
	db := database.GetDB(ctx, r.db)

	query := db.WithContext(ctx).
		Table("shifts s").
		Select(`
			s.id                    AS shift_id,
			s.staff_id              AS staff_id,
			COALESCE(u.name, '')    AS staff_name,
			s.device_id             AS device_id,
			s.status                AS status,
			s.opening_balance       AS opening_balance,
			s.declared_cash         AS declared_cash,
			s.declared_edc_total    AS declared_edc_total,
			s.declared_qris_total   AS declared_qris_total,
			s.blind_close           AS blind_close,
			s.expected_cash         AS expected_cash,
			s.expected_edc_total    AS expected_edc_total,
			s.expected_qris_total   AS expected_qris_total,
			s.cash_variance         AS cash_variance,
			s.edc_variance          AS edc_variance,
			s.qris_variance         AS qris_variance,
			s.client_opened_at      AS client_opened_at,
			s.client_closed_at      AS client_closed_at,
			s.reconciled_at         AS reconciled_at
		`).
		Joins("LEFT JOIN users u ON u.id = s.staff_id").
		Where("s.business_id = ?", f.BusinessID)

	if f.OutletID != "" {
		query = query.Where("s.outlet_id = ?", f.OutletID)
	}
	if f.StartDate != "" {
		query = query.Where("s.client_opened_at >= ?", f.StartDate)
	}
	if f.EndDate != "" {
		// Batas atas inklusif-hari: `end_date` datang sebagai tanggal telanjang
		// (`2026-08-20`), yang diurai Postgres sebagai tengah malam. Tanpa
		// pergeseran ini, shift yang dibuka pada hari terakhir rentang tidak
		// pernah muncul di laporannya sendiri.
		query = query.Where("s.client_opened_at < (?::date + INTERVAL '1 day')", f.EndDate)
	}

	var rows []*domain.ShiftReconciliationRow
	if err := query.Order("s.client_opened_at DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

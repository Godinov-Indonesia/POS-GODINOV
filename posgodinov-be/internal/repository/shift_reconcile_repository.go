package repository

import (
	"context"
	"time"

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

// GetShiftDetail mengambil seluruh rincian operasional satu shift secara on-demand.
func (r *shiftReconcileRepository) GetShiftDetail(ctx context.Context, businessID, outletID, shiftID string) (*domain.ShiftDetailResponse, error) {
	db := database.GetDB(ctx, r.db)

	// ── 1. Shift Summary ───────────────────────────────────────────────────
	var shiftRow struct {
		ID                string
		OutletID          string
		StaffID           string
		StaffName         string
		DeviceID          string
		Status            string
		BlindClose        bool
		ClientOpenedAt    time.Time
		ClientClosedAt    *time.Time
		ReconciledAt      *time.Time
		OpeningBalance    float64
		DeclaredCash      float64
		DeclaredEDCTotal  float64
		DeclaredQRISTotal float64
		ExpectedCash      *float64
		ExpectedEDCTotal  *float64
		ExpectedQRISTotal *float64
		CashVariance      *float64
		EDCVariance       *float64
		QRISVariance      *float64
	}

	if err := db.WithContext(ctx).
		Table("shifts s").
		Select(`
			s.id,
			s.outlet_id,
			s.staff_id,
			COALESCE(u.name, '') AS staff_name,
			s.device_id,
			s.status,
			s.blind_close,
			s.client_opened_at,
			s.client_closed_at,
			s.reconciled_at,
			s.opening_balance,
			s.declared_cash,
			s.declared_edc_total,
			s.declared_qris_total,
			s.expected_cash,
			s.expected_edc_total,
			s.expected_qris_total,
			s.cash_variance,
			s.edc_variance,
			s.qris_variance
		`).
		Joins("LEFT JOIN users u ON u.id = s.staff_id").
		Where("s.id = ? AND s.business_id = ? AND s.outlet_id = ?", shiftID, businessID, outletID).
		Scan(&shiftRow).Error; err != nil {
		return nil, err
	}

	if shiftRow.ID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	summary := domain.ShiftSummary{
		ShiftID:        shiftRow.ID,
		OutletID:       shiftRow.OutletID,
		StaffID:        shiftRow.StaffID,
		StaffName:      shiftRow.StaffName,
		DeviceID:       shiftRow.DeviceID,
		Status:         shiftRow.Status,
		BlindClose:     shiftRow.BlindClose,
		OpenedAt:       shiftRow.ClientOpenedAt,
		OpeningBalance: shiftRow.OpeningBalance,
		ClosedAt:       shiftRow.ClientClosedAt,
		ReconciledAt:   shiftRow.ReconciledAt,
		Cash: domain.ShiftVarianceDetail{
			Declared: shiftRow.DeclaredCash,
			Expected: shiftRow.ExpectedCash,
			Variance: shiftRow.CashVariance,
		},
		EDC: domain.ShiftVarianceDetail{
			Declared: shiftRow.DeclaredEDCTotal,
			Expected: shiftRow.ExpectedEDCTotal,
			Variance: shiftRow.EDCVariance,
		},
		QRIS: domain.ShiftVarianceDetail{
			Declared: shiftRow.DeclaredQRISTotal,
			Expected: shiftRow.ExpectedQRISTotal,
			Variance: shiftRow.QRISVariance,
		},
	}

	// ── 2. Transaksi & Detail Items ─────────────────────────────────────────
	var txRows []struct {
		ID               string
		ShortCode        *string
		CustomerName     string
		TotalAmount      float64
		PaymentMethod    string
		Status           string
		ReprintCount     int
		ReceiptPrintedAt *time.Time
		CreatedAt        time.Time
	}

	if err := db.WithContext(ctx).
		Table("transactions").
		Select(`
			id,
			short_code,
			customer_name,
			total_amount,
			payment_method,
			status,
			reprint_count,
			receipt_printed_at,
			created_at
		`).
		Where("shift_id = ?", shiftID).
		Order("client_created_at DESC").
		Scan(&txRows).Error; err != nil {
		return nil, err
	}

	txList := make([]domain.ShiftTransactionRecord, 0, len(txRows))
	txIDs := make([]string, 0, len(txRows))
	var completedCount, voidedCount int
	var totalGross float64

	for _, tr := range txRows {
		receiptCode := tr.ID
		if tr.ShortCode != nil && *tr.ShortCode != "" {
			receiptCode = *tr.ShortCode
		}

		rec := domain.ShiftTransactionRecord{
			ID:               tr.ID,
			ReceiptCode:      receiptCode,
			CustomerName:     tr.CustomerName,
			TotalAmount:      tr.TotalAmount,
			PaymentMethod:    tr.PaymentMethod,
			Status:           tr.Status,
			ReprintCount:     tr.ReprintCount,
			ReceiptPrintedAt: tr.ReceiptPrintedAt,
			CreatedAt:        tr.CreatedAt,
			Items:            []domain.ShiftTransactionItem{},
		}

		if tr.Status == domain.TxStatusCompleted {
			completedCount++
			totalGross += tr.TotalAmount
		} else if domain.IsCancellation(tr.Status) {
			voidedCount++
		}

		txList = append(txList, rec)
		txIDs = append(txIDs, tr.ID)
	}

	// Batch query item transaksi
	if len(txIDs) > 0 {
		var itemRows []struct {
			ID            string
			TransactionID string
			ProductID     string
			ProductName   string
			SKU           string
			Quantity      int
			UnitPrice     float64
			Subtotal      float64
		}

		if err := db.WithContext(ctx).
			Table("transaction_items ti").
			Select(`
				ti.id,
				ti.transaction_id,
				ti.product_id,
				COALESCE(p.name, '') AS product_name,
				COALESCE(p.sku, '')  AS sku,
				ti.quantity,
				ti.unit_price,
				(ti.quantity * ti.unit_price) AS subtotal
			`).
			Joins("LEFT JOIN products p ON p.id = ti.product_id").
			Where("ti.transaction_id IN ?", txIDs).
			Order("ti.id ASC").
			Scan(&itemRows).Error; err != nil {
			return nil, err
		}

		itemsByTx := make(map[string][]domain.ShiftTransactionItem, len(txIDs))
		for _, item := range itemRows {
			itemsByTx[item.TransactionID] = append(itemsByTx[item.TransactionID], domain.ShiftTransactionItem{
				ID:          item.ID,
				ProductID:   item.ProductID,
				ProductName: item.ProductName,
				SKU:         item.SKU,
				Quantity:    item.Quantity,
				UnitPrice:   item.UnitPrice,
				Subtotal:    item.Subtotal,
			})
		}

		for i := range txList {
			if items, ok := itemsByTx[txList[i].ID]; ok {
				txList[i].Items = items
			}
		}
	}

	// Breakdown metode pembayaran
	paymentBreakdown := make(map[string]float64)
	var paymentRows []struct {
		Method string
		Amount float64
	}
	if err := db.WithContext(ctx).
		Table("transaction_payments p").
		Select("p.method, COALESCE(SUM(p.amount), 0) AS amount").
		Joins("JOIN transactions t ON t.id = p.transaction_id").
		Where("t.shift_id = ? AND t.status = ?", shiftID, domain.TxStatusCompleted).
		Group("p.method").
		Scan(&paymentRows).Error; err == nil {
		for _, pr := range paymentRows {
			paymentBreakdown[pr.Method] = pr.Amount
		}
	}

	txMetric := domain.ShiftTransactionsMetric{
		TotalCount:       len(txList),
		CompletedCount:   completedCount,
		VoidedCount:      voidedCount,
		TotalGrossAmount: totalGross,
		TotalNetAmount:   totalGross,
		PaymentBreakdown: paymentBreakdown,
		Transactions:     txList,
	}

	// ── 3. Cetak Ulang Struk (Reprint) ──────────────────────────────────────
	var reprintedTx []domain.ShiftReceiptPrintRecord
	for _, tr := range txList {
		if tr.ReprintCount > 0 {
			reprintedTx = append(reprintedTx, domain.ShiftReceiptPrintRecord{
				TransactionID:    tr.ID,
				ReceiptCode:      tr.ReceiptCode,
				ReprintCount:     tr.ReprintCount,
				ReceiptPrintedAt: tr.ReceiptPrintedAt,
			})
		}
	}
	receiptPrintsMetric := domain.ShiftReceiptPrintsMetric{
		TotalReprinted:        len(reprintedTx),
		TransactionsReprinted: reprintedTx,
	}

	// ── 4. Void Logs ────────────────────────────────────────────────────────
	var voidRows []struct {
		ID               string
		Scope            string
		ProductID        *string
		ProductName      string
		QuantityBefore   int
		QuantityAfter    int
		ValueAmount      float64
		ReasonCode       string
		ReasonNotes      string
		StaffName        string
		AuthorizedByName string
		CreatedAt        time.Time
	}

	if err := db.WithContext(ctx).
		Table("void_logs v").
		Select(`
			v.id,
			v.scope,
			v.product_id,
			COALESCE(p.name, '') AS product_name,
			v.quantity_before,
			v.quantity_after,
			v.value_amount,
			v.reason_code,
			v.reason_notes,
			COALESCE(u.name, '') AS staff_name,
			COALESCE(auth.name, '') AS authorized_by_name,
			v.created_at
		`).
		Joins("LEFT JOIN products p ON p.id = v.product_id").
		Joins("LEFT JOIN users u ON u.id = v.staff_id").
		Joins("LEFT JOIN users auth ON auth.id = v.authorized_by").
		Where("v.shift_id = ?", shiftID).
		Order("v.created_at DESC").
		Scan(&voidRows).Error; err != nil {
		return nil, err
	}

	voidList := make([]domain.ShiftVoidItem, 0, len(voidRows))
	var totalVoidValue float64
	for _, vr := range voidRows {
		totalVoidValue += vr.ValueAmount
		voidList = append(voidList, domain.ShiftVoidItem{
			ID:               vr.ID,
			Scope:            vr.Scope,
			ProductID:        vr.ProductID,
			ProductName:      vr.ProductName,
			QuantityBefore:   vr.QuantityBefore,
			QuantityAfter:    vr.QuantityAfter,
			ValueAmount:      vr.ValueAmount,
			ReasonCode:       vr.ReasonCode,
			ReasonNotes:      vr.ReasonNotes,
			StaffName:        vr.StaffName,
			AuthorizedByName: vr.AuthorizedByName,
			CreatedAt:        vr.CreatedAt,
		})
	}
	voidsMetric := domain.ShiftVoidsMetric{
		TotalCount:       len(voidList),
		TotalValueAmount: totalVoidValue,
		Items:            voidList,
	}

	// ── 5. Waste Logs (Produk POS & Bahan Baku) ─────────────────────────────
	wasteList := make([]domain.ShiftWasteItem, 0)

	// Produk waste dari POS
	var pwRows []struct {
		ID             string
		ProductID      string
		ProductName    string
		Quantity       int
		Reason         string
		ReasonCode     string
		RecordedByName string
		CreatedAt      time.Time
	}
	if err := db.WithContext(ctx).
		Table("product_wastes pw").
		Select(`
			pw.id,
			pw.product_id,
			COALESCE(p.name, '') AS product_name,
			pw.quantity,
			pw.reason,
			pw.reason_code,
			COALESCE(u.name, '') AS recorded_by_name,
			pw.created_at
		`).
		Joins("LEFT JOIN products p ON p.id = pw.product_id").
		Joins("LEFT JOIN users u ON u.id = pw.staff_id").
		Where("pw.shift_id = ?", shiftID).
		Order("pw.created_at DESC").
		Scan(&pwRows).Error; err == nil {
		for _, pw := range pwRows {
			wasteList = append(wasteList, domain.ShiftWasteItem{
				ID:             pw.ID,
				ItemID:         pw.ProductID,
				ItemName:       pw.ProductName,
				WasteType:      "PRODUCT",
				Quantity:       float64(pw.Quantity),
				Unit:           "pcs",
				Reason:         pw.Reason,
				ReasonCode:     pw.ReasonCode,
				RecordedByName: pw.RecordedByName,
				CreatedAt:      pw.CreatedAt,
			})
		}
	}

	// Bahan baku waste dalam rentang shift
	openedAt := shiftRow.ClientOpenedAt
	closedAt := openedAt
	if shiftRow.ClientClosedAt != nil {
		closedAt = *shiftRow.ClientClosedAt
	} else {
		closedAt = time.Now()
	}

	var rmWasteRows []struct {
		ID             string
		RawMaterialID  string
		ItemName       string
		Quantity       float64
		Unit           string
		Reason         string
		RecordedByName string
		CreatedAt      time.Time
	}
	if err := db.WithContext(ctx).
		Table("waste_logs wl").
		Select(`
			wl.id,
			wl.raw_material_id,
			COALESCE(rm.name, '') AS item_name,
			wl.quantity,
			COALESCE(rm.unit, 'satuan') AS unit,
			wl.reason,
			COALESCE(u.name, '') AS recorded_by_name,
			wl.created_at
		`).
		Joins("LEFT JOIN raw_materials rm ON rm.id = wl.raw_material_id").
		Joins("LEFT JOIN users u ON u.id = wl.recorded_by").
		Where("wl.outlet_id = ? AND wl.created_at >= ? AND wl.created_at <= ?", outletID, openedAt, closedAt).
		Order("wl.created_at DESC").
		Scan(&rmWasteRows).Error; err == nil {
		for _, rw := range rmWasteRows {
			wasteList = append(wasteList, domain.ShiftWasteItem{
				ID:             rw.ID,
				ItemID:         rw.RawMaterialID,
				ItemName:       rw.ItemName,
				WasteType:      "RAW_MATERIAL",
				Quantity:       rw.Quantity,
				Unit:           rw.Unit,
				Reason:         rw.Reason,
				ReasonCode:     "",
				RecordedByName: rw.RecordedByName,
				CreatedAt:      rw.CreatedAt,
			})
		}
	}

	wastesMetric := domain.ShiftWastesMetric{
		TotalCount: len(wasteList),
		Items:      wasteList,
	}

	// ── 6. Returns ──────────────────────────────────────────────────────────
	var retRows []struct {
		ID                    string
		OriginalTransactionID string
		RefundAmount          float64
		RefundMethod          string
		ReasonCode            string
		CreatedAt             time.Time
	}

	if err := db.WithContext(ctx).
		Table("returns r").
		Select(`
			r.id,
			r.original_transaction_id,
			r.refund_amount,
			r.refund_method,
			r.reason_code,
			r.created_at
		`).
		Where("r.shift_id = ?", shiftID).
		Order("r.created_at DESC").
		Scan(&retRows).Error; err != nil {
		return nil, err
	}

	retList := make([]domain.ShiftReturnItem, 0, len(retRows))
	var totalRefund float64
	for _, rr := range retRows {
		totalRefund += rr.RefundAmount
		retList = append(retList, domain.ShiftReturnItem{
			ID:            rr.ID,
			TransactionID: rr.OriginalTransactionID,
			RefundAmount:  rr.RefundAmount,
			RefundMethod:  rr.RefundMethod,
			Reason:        rr.ReasonCode,
			CreatedAt:     rr.CreatedAt,
		})
	}

	returnsMetric := domain.ShiftReturnsMetric{
		TotalCount:        len(retList),
		TotalRefundAmount: totalRefund,
		Items:             retList,
	}

	// ── 7. Security Events ──────────────────────────────────────────────────
	var secRows []struct {
		ID        string
		EventType string
		Severity  string
		Details   domain.JSONB
		CreatedAt time.Time
	}

	secEvents := make([]domain.ShiftSecurityEventRecord, 0)
	if err := db.WithContext(ctx).
		Table("pos_security_events").
		Select("id, event_type, severity, details, created_at").
		Where("shift_id = ?", shiftID).
		Order("created_at DESC").
		Scan(&secRows).Error; err == nil {
		for _, sr := range secRows {
			secEvents = append(secEvents, domain.ShiftSecurityEventRecord{
				ID:        sr.ID,
				EventType: sr.EventType,
				Severity:  sr.Severity,
				Details:   sr.Details,
				CreatedAt: sr.CreatedAt,
			})
		}
	}

	return &domain.ShiftDetailResponse{
		ShiftSummary:        summary,
		TransactionsMetric:  txMetric,
		ReceiptPrintsMetric: receiptPrintsMetric,
		VoidsMetric:         voidsMetric,
		WastesMetric:        wastesMetric,
		ReturnsMetric:       returnsMetric,
		SecurityEvents:      secEvents,
	}, nil
}

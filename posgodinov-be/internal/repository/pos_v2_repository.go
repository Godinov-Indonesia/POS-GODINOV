package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

// ════════════════════════════════════════════════════════════════════════════
// Repositori entitas v2 — Fase M11.2 ([11 §4.7])
//
// Seluruhnya memakai `database.GetDB(ctx, r.db)` agar ikut serta dalam
// transaksi yang dibuka `TransactionManager`. Melewatkannya berarti penulisan
// terjadi di koneksi lain, di luar transaksi, dan rollback tidak
// membatalkannya — kegagalan paling senyap yang mungkin terjadi pada data
// keuangan.
// ════════════════════════════════════════════════════════════════════════════

/* ── Tender ───────────────────────────────────────────────────────────────── */

type transactionPaymentRepository struct{ db *gorm.DB }

func NewTransactionPaymentRepository(db *gorm.DB) domain.TransactionPaymentRepository {
	return &transactionPaymentRepository{db: db}
}

func (r *transactionPaymentRepository) SaveMany(ctx context.Context, payments []*domain.TransactionPayment) error {
	if len(payments) == 0 {
		return nil
	}
	db := database.GetDB(ctx, r.db)
	// DoNothing, bukan DoUpdate: tender yang sudah tercatat adalah kesaksian
	// perangkat pada saat uang berpindah. Pengiriman ulang tidak membawa
	// informasi baru, hanya risiko menimpanya dengan nilai yang sudah berubah.
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(&payments).Error
}

// UpdateSummary menuliskan kembali kolom ringkasan ke baris induk.
//
// Memakai `Updates` dengan map, bukan struct: GORM melewatkan field bernilai nol
// pada pembaruan berbasis struct, sehingga transaksi yang seluruhnya non-tunai
// akan mempertahankan `cash_amount` lamanya alih-alih menjadi nol.
func (r *transactionPaymentRepository) UpdateSummary(ctx context.Context, transactionID string, sum domain.TenderSummary) error {
	db := database.GetDB(ctx, r.db)

	fields := map[string]any{
		"tender_count":         sum.TenderCount,
		"cash_amount":          sum.CashAmount,
		"noncash_amount":       sum.NonCashAmount,
		"primary_trace_number": sum.PrimaryTraceNumber,
		"primary_card_last4":   sum.PrimaryCardLast4,
	}
	// `payment_method` hanya ditimpa bila ringkasannya benar-benar terhitung.
	// Menimpanya dengan string kosong akan menghapus metode pembayaran sebuah
	// penjualan yang sudah terjadi.
	if sum.PaymentMethod != "" {
		fields["payment_method"] = sum.PaymentMethod
	}

	return db.WithContext(ctx).
		Model(&domain.Transaction{}).
		Where("id = ?", transactionID).
		Updates(fields).Error
}

func (r *transactionPaymentRepository) GetByTransactionID(ctx context.Context, transactionID string) ([]*domain.TransactionPayment, error) {
	db := database.GetDB(ctx, r.db)
	var out []*domain.TransactionPayment
	err := db.WithContext(ctx).
		Where("transaction_id = ?", transactionID).
		Order("sequence ASC").
		Find(&out).Error
	return out, err
}

/* ── Retur ────────────────────────────────────────────────────────────────── */

type returnRepository struct{ db *gorm.DB }

func NewReturnRepository(db *gorm.DB) domain.ReturnRepository {
	return &returnRepository{db: db}
}

func (r *returnRepository) Save(ctx context.Context, ret *domain.Return) error {
	db := database.GetDB(ctx, r.db)
	// DO NOTHING, BUKAN DO UPDATE ([11 §4.8]): retur yang sudah tercatat tidak
	// boleh ditimpa oleh pengiriman ulang yang membawa nilai berbeda akibat jam
	// perangkat mundur. Uang sudah kembali ke pelanggan; nominalnya tidak boleh
	// berubah setelah itu.
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(ret).Error
}

func (r *returnRepository) GetByID(ctx context.Context, id string) (*domain.Return, error) {
	db := database.GetDB(ctx, r.db)
	var out domain.Return
	if err := db.WithContext(ctx).Preload("Items").Where("id = ?", id).First(&out).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("retur tidak ditemukan")
		}
		return nil, err
	}
	return &out, nil
}

func (r *returnRepository) ListByOriginalTransaction(ctx context.Context, transactionID string) ([]*domain.Return, error) {
	db := database.GetDB(ctx, r.db)
	var out []*domain.Return
	err := db.WithContext(ctx).
		Preload("Items").
		Where("original_transaction_id = ?", transactionID).
		Order("client_created_at ASC").
		Find(&out).Error
	return out, err
}

// SnapshotForReturn mengunci baris item transaksi asal, lalu mengembalikan
// kuantitas asal beserta yang sudah diretur.
//
// # Mengapa penguncian terjadi pada `transaction_items`, bukan pada `returns`
//
// Dua retur yang tiba bersamaan atas item yang SAMA masing-masing akan membaca
// "sudah diretur 0 dari 2", dan keduanya lolos — total teretur menjadi 4 dari 2.
// Mengunci `returns` tidak menolong: baris yang hendak disisipkan belum ada,
// jadi tidak ada yang bisa dikunci. Yang dikunci harus baris yang PASTI sudah
// ada dan sama bagi kedua transaksi, yaitu item transaksi aslinya.
//
// # Mengapa dua kueri, bukan satu
//
// PostgreSQL melarang `FOR UPDATE` bersama `GROUP BY`, sehingga penguncian dan
// penjumlahan tidak dapat digabung. Keduanya tetap berada di dalam SATU
// transaksi basis data, sehingga kunci dari kueri pertama masih dipegang saat
// kueri kedua berjalan — itulah yang membuat pemisahan ini aman.
//
// `ORDER BY id` pada kueri penguncian mencegah deadlock: dua retur atas
// transaksi yang sama akan meminta baris dalam urutan yang identik.
func (r *returnRepository) SnapshotForReturn(ctx context.Context, transactionID string) (*domain.ReturnSnapshot, error) {
	db := database.GetDB(ctx, r.db)

	type itemRow struct {
		ID        string
		ProductID string
		Quantity  int
		UnitPrice float64
	}

	var items []itemRow
	if err := db.WithContext(ctx).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Table("transaction_items").
		Select("id, product_id, quantity, unit_price").
		Where("transaction_id = ?", transactionID).
		Order("id").
		Scan(&items).Error; err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return &domain.ReturnSnapshot{Items: []*domain.ReturnableItem{}}, nil
	}

	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}

	type sumRow struct {
		TransactionItemID string
		Total             int
	}
	var sums []sumRow
	if err := db.WithContext(ctx).
		Table("return_items").
		Select("transaction_item_id, COALESCE(SUM(quantity), 0) AS total").
		Where("transaction_item_id IN ?", ids).
		Group("transaction_item_id").
		Scan(&sums).Error; err != nil {
		return nil, err
	}

	returned := make(map[string]int, len(sums))
	for _, s := range sums {
		returned[s.TransactionItemID] = s.Total
	}

	out := make([]*domain.ReturnableItem, 0, len(items))
	for _, item := range items {
		already := returned[item.ID]
		remaining := item.Quantity - already
		if remaining < 0 {
			// Penjepitan ke nol bukan paranoia. Data yang sudah terlanjur
			// melebihi batas — mis. akibat backfill manual — tidak boleh
			// menghasilkan sisa negatif yang membuat aritmetika di atasnya
			// diam-diam salah arah.
			remaining = 0
		}
		out = append(out, &domain.ReturnableItem{
			TransactionItemID: item.ID,
			ProductID:         item.ProductID,
			OriginalQuantity:  item.Quantity,
			AlreadyReturned:   already,
			Returnable:        remaining,
			UnitPrice:         item.UnitPrice,
		})
	}

	return &domain.ReturnSnapshot{Items: out}, nil
}

// UpdateReturnState menuliskan kembali agregat ke baris transaksi asal.
func (r *returnRepository) UpdateReturnState(ctx context.Context, transactionID, state string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).
		Model(&domain.Transaction{}).
		Where("id = ?", transactionID).
		Update("return_state", state).Error
}

/* ── Log pembatalan ───────────────────────────────────────────────────────── */

type voidLogRepository struct{ db *gorm.DB }

func NewVoidLogRepository(db *gorm.DB) domain.VoidLogRepository {
	return &voidLogRepository{db: db}
}

func (r *voidLogRepository) Save(ctx context.Context, log *domain.VoidLog) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(log).Error
}

func (r *voidLogRepository) GetByID(ctx context.Context, id string) (*domain.VoidLog, error) {
	db := database.GetDB(ctx, r.db)
	var out domain.VoidLog
	if err := db.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("log pembatalan tidak ditemukan")
		}
		return nil, err
	}
	return &out, nil
}

func (r *voidLogRepository) ListByShift(ctx context.Context, shiftID string) ([]*domain.VoidLog, error) {
	db := database.GetDB(ctx, r.db)
	var out []*domain.VoidLog
	err := db.WithContext(ctx).
		Where("shift_id = ?", shiftID).
		Order("client_created_at DESC").
		Find(&out).Error
	return out, err
}

/* ── Audit keamanan ───────────────────────────────────────────────────────── */

type securityEventRepository struct{ db *gorm.DB }

func NewSecurityEventRepository(db *gorm.DB) domain.SecurityEventRepository {
	return &securityEventRepository{db: db}
}

func (r *securityEventRepository) Save(ctx context.Context, event *domain.SecurityEvent) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(event).Error
}

func (r *securityEventRepository) ListByOutlet(ctx context.Context, outletID string, limit, offset int) ([]*domain.SecurityEvent, error) {
	db := database.GetDB(ctx, r.db)
	var out []*domain.SecurityEvent
	err := db.WithContext(ctx).
		Where("outlet_id = ?", outletID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&out).Error
	return out, err
}

/* ── Versi master data (butir 10) ─────────────────────────────────────────── */

type masterVersionRepository struct{ db *gorm.DB }

func NewMasterVersionRepository(db *gorm.DB) domain.MasterVersionRepository {
	return &masterVersionRepository{db: db}
}

func (r *masterVersionRepository) Get(ctx context.Context, outletID string) (int64, error) {
	db := database.GetDB(ctx, r.db)
	var version int64
	err := db.WithContext(ctx).
		Table("outlet_master_versions").
		Where("outlet_id = ?", outletID).
		Select("version").
		Scan(&version).Error
	if err != nil {
		return 0, err
	}
	// Outlet yang belum punya baris penghitung dianggap berversi 0, bukan galat.
	// Outlet baru harus dapat melayani penjualan sebelum siapa pun menyentuh
	// master data-nya.
	return version, nil
}

// Bump menaikkan versi secara atomik.
//
// ⚠️ WAJIB dipanggil di dalam transaksi basis data YANG SAMA dengan mutasi
// produk, kategori, resep, atau staff. Memanggilnya setelah commit membuka
// jendela — sekecil apa pun — saat perangkat menarik master data lama tetapi
// mencatat versi baru. Gerbang Buka Shift akan meloloskannya, dan kasir
// berjualan dengan harga kemarin sambil sistem yakin ia sudah mutakhir.
//
// `ON CONFLICT` menangani outlet yang belum memiliki baris penghitung,
// sehingga pemanggil tidak perlu tahu apakah barisnya sudah ada.
func (r *masterVersionRepository) Bump(ctx context.Context, outletID string) (int64, error) {
	db := database.GetDB(ctx, r.db)

	var version int64
	err := db.WithContext(ctx).Raw(`
		INSERT INTO outlet_master_versions (outlet_id, version, updated_at)
		VALUES (?, 1, ?)
		ON CONFLICT (outlet_id) DO UPDATE
		SET version = outlet_master_versions.version + 1, updated_at = EXCLUDED.updated_at
		RETURNING version
	`, outletID, time.Now()).Scan(&version).Error

	return version, err
}

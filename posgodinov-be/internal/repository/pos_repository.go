package repository

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type posRepository struct {
	db *gorm.DB
}

func NewPOSRepository(db *gorm.DB) domain.POSRepository {
	return &posRepository{db: db}
}

// SaveShift meng-upsert shift; pengiriman ulang aman.
//
// ⚠️ Daftar DoUpdates adalah KONTRAK, bukan detail. Shift dikirim DUA KALI —
// sekali saat dibuka (agar transaksi anaknya punya induk di server) dan sekali
// saat ditutup. Kolom yang tidak ada di daftar ini akan membeku pada nilai
// pengiriman PERTAMA, yaitu nol.
//
// Itulah yang terjadi pada `declared_*` sebelum M15.3: ketiga angka deklarasi
// kasir — satu-satunya keluaran Blind Closing — tersimpan sebagai 0 selamanya,
// dan `ShiftReconcileService` menghitung selisih terhadap nol.
//
// `expected_*`, `*_variance`, dan `reconciled_at` sengaja TIDAK ada di sini:
// keduanya milik `UpdateShiftReconciliation`, dan membiarkan jalur sinkronisasi
// menulisnya berarti mengembalikan wewenang itu ke perangkat kasir (R4).
func (r *posRepository) SaveShift(ctx context.Context, shift *domain.Shift) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"closing_balance", "status", "client_closed_at",

			// v2 — kesaksian kasir (butir 9).
			"declared_cash", "declared_edc_total", "declared_qris_total",
			"blind_close", "closed_by",

			// v2 — gerbang & penguncian sesi (butir 10 & 12).
			"master_data_version", "device_id",
		}),
	}).Create(shift).Error
}

func (r *posRepository) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	db := database.GetDB(ctx, r.db)
	var s domain.Shift
	if err := db.WithContext(ctx).Where("id = ?", id).First(&s).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("shift not found")
		}
		return nil, err
	}
	return &s, nil
}

func (r *posRepository) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	db := database.GetDB(ctx, r.db)
	// Create transaction with its items. We use OnConflict DoNothing for idempotency on the main transaction level.
	// If it already exists, we do nothing to prevent double processing.
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(trx).Error
}

func (r *posRepository) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)
	var t domain.Transaction
	if err := db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	return &t, nil
}

func (r *posRepository) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)
	var transactions []*domain.Transaction
	
	err := db.WithContext(ctx).
		Where("outlet_id = ?", outletID).
		Preload("Items").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&transactions).Error
		
	return transactions, err
}

func (r *posRepository) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Model(&domain.Transaction{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       status,
		"cancel_notes": cancelNotes,
	}).Error
}

func (r *posRepository) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(waste).Error
}

func (r *posRepository) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	db := database.GetDB(ctx, r.db)
	var w domain.ProductWaste
	if err := db.WithContext(ctx).Where("id = ?", id).First(&w).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("product waste not found")
		}
		return nil, err
	}
	return &w, nil
}

// LookupTransaction mencari SATU transaksi lewat kode struk atau UUID penuh —
// butir 16 ([11 §M17.3]).
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU BARIS, BUKAN DAFTAR — DAN ITU INTI BUTIR 16
// ═══════════════════════════════════════════════════════════════════════════
//
// `First`, bukan `Find`. Endpoint yang mengembalikan daftar adalah penelusuran
// massal dengan nama lain: kasir dapat mengetik dua karakter dan memperoleh
// seluruh riwayat outlet, yang persis keadaan yang butir 16 tutup.
//
// Pencocokan bersifat EKSAK (`=`), bukan `LIKE '%kode%'`. Pencarian sebagian
// mengubah kolom terindeks menjadi pemindaian tabel penuh, DAN mengembalikan
// transaksi yang tidak dicari siapa pun.
//
// `outlet_id` selalu menjadi syarat. Kode yang tidak ada dan kode milik outlet
// lain menghasilkan galat yang SAMA — membedakannya akan membocorkan
// keberadaan transaksi cabang lain lewat pesan galat.
func (r *posRepository) LookupTransaction(ctx context.Context, outletID, code string) (*domain.Transaction, error) {
	db := database.GetDB(ctx, r.db)

	trimmed := strings.TrimSpace(code)
	if trimmed == "" {
		return nil, errors.New("kode transaksi kosong")
	}

	var t domain.Transaction
	err := db.WithContext(ctx).
		Preload("Items").
		Preload("Payments").
		Where("outlet_id = ?", outletID).
		// `short_code` diterbitkan huruf besar; kasir mengetiknya dari kertas
		// tanpa memperhatikan kapitalisasi. UUID dicocokkan apa adanya.
		Where("short_code = ? OR id = ?", strings.ToUpper(trimmed), trimmed).
		First(&t).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("transaksi tidak ditemukan")
		}
		return nil, err
	}
	return &t, nil
}

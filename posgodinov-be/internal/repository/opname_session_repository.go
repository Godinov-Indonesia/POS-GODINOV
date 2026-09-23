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

type opnameSessionRepository struct{ db *gorm.DB }

func NewOpnameSessionRepository(db *gorm.DB) domain.OpnameSessionRepository {
	return &opnameSessionRepository{db: db}
}

func (r *opnameSessionRepository) Create(ctx context.Context, session *domain.OpnameSession) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(session).Error
}

func (r *opnameSessionRepository) GetByID(ctx context.Context, id string) (*domain.OpnameSession, error) {
	db := database.GetDB(ctx, r.db)
	var out domain.OpnameSession
	if err := db.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("sesi opname tidak ditemukan")
		}
		return nil, err
	}
	return &out, nil
}

func (r *opnameSessionRepository) ListByOutlet(ctx context.Context, outletID, status string, limit, offset int) ([]*domain.OpnameSession, error) {
	db := database.GetDB(ctx, r.db)
	q := db.WithContext(ctx).Where("outlet_id = ?", outletID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var out []*domain.OpnameSession
	err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&out).Error
	return out, err
}

// UpsertItems menulis hitungan fisik petugas.
//
// ⚠️ Daftar kolom `DoUpdates` sengaja DIBATASI pada kolom hitungan. Menyertakan
// `system_stock`, `difference`, atau `fraud_flag` di sini akan membuat siapa pun
// yang memanggil metode ini mampu menulis angka ekspektasi — dan butir 3 runtuh
// tanpa satu baris kode pun terlihat salah. Ketiganya HANYA ditulis oleh Lock.
func (r *opnameSessionRepository) UpsertItems(ctx context.Context, sessionID string, items []*domain.OpnameSessionItem) error {
	if len(items) == 0 {
		return nil
	}
	db := database.GetDB(ctx, r.db)
	for _, it := range items {
		it.SessionID = sessionID
	}
	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "session_id"}, {Name: "raw_material_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"actual_stock", "actual_package_quantity", "input_type", "notes",
		}),
	}).Create(&items).Error
}

func (r *opnameSessionRepository) ListItems(ctx context.Context, sessionID string) ([]*domain.OpnameSessionItem, error) {
	db := database.GetDB(ctx, r.db)
	var out []*domain.OpnameSessionItem
	err := db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&out).Error
	return out, err
}

// Lock adalah SATU-SATUNYA jalur yang menulis angka ekspektasi — butir 3.
//
// # Mengapa satu pernyataan, bukan baca-lalu-tulis di Go
//
// Menarik stok ke memori, menghitung selisih di Go, lalu menuliskannya kembali
// membuka jendela antara pembacaan dan penulisan. Penjualan yang terjadi di
// jendela itu menghasilkan selisih yang salah — dan selisih yang salah pada
// opname berarti tuduhan kehilangan barang terhadap orang yang tidak
// melakukannya. `UPDATE ... FROM` mengunci dan menghitung dalam satu langkah.
//
// `FOR UPDATE` pada baris `raw_materials` menahan sinkronisasi penjualan yang
// hendak memotong stok bahan yang sama sampai penguncian selesai.
func (r *opnameSessionRepository) Lock(ctx context.Context, sessionID string, lockedAt time.Time) error {
	db := database.GetDB(ctx, r.db)

	// 1. Kunci bahan baku yang terlibat. Urutan `ORDER BY id` mencegah deadlock
	//    bila dua sesi opname pada outlet berbeda menyentuh bahan yang sama.
	var lockedIDs []string
	if err := db.WithContext(ctx).Raw(`
		SELECT rm.id FROM raw_materials rm
		WHERE rm.id IN (SELECT raw_material_id FROM opname_session_items WHERE session_id = ?)
		ORDER BY rm.id
		FOR UPDATE
	`, sessionID).Scan(&lockedIDs).Error; err != nil {
		return err
	}

	// 2. Ambil snapshot dan hitung selisih dalam satu pernyataan.
	//
	//    `fraud_flag` menyatukan DUA ambang dengan OR, karena masing-masing buta
	//    pada satu sisi ([11 §M16.3]):
	//
	//      · RASIO (>10 %) melewatkan kehilangan 4 kg dari 500 kg daging —
	//        0,8 %, tetapi jutaan rupiah.
	//      · NOMINAL (>Rp 50.000) melewatkan hilangnya SELURUH persediaan garam
	//        — 100 %, tetapi hanya beberapa ribu rupiah, dan tetap merupakan
	//        tanda bahwa ada yang salah dengan penyimpanannya.
	//
	//    Stok sistem NOL ditangani terpisah: pembagian dengan nol menghasilkan
	//    NULL di Postgres, dan `fraud_flag` bertipe NOT NULL. Barang yang
	//    menurut sistem habis tetapi ternyata ada di gudang adalah temuan yang
	//    justru paling layak ditinjau.
	//
	//    `system_package_quantity` diisi hanya bila bahan bakunya memang punya
	//    satuan paket; bahan yang dihitung per gram tidak punya "berapa kaleng".
	if err := db.WithContext(ctx).Exec(`
		UPDATE opname_session_items i
		SET system_stock     = rm.stock,
		    system_package_quantity = CASE
		        WHEN rm.quantity_per_package IS NULL OR rm.quantity_per_package = 0
		            THEN NULL
		        ELSE rm.stock / rm.quantity_per_package
		    END,
		    difference       = i.actual_stock - rm.stock,
		    difference_value = (i.actual_stock - rm.stock) * rm.cost_per_unit,
		    fraud_flag       = CASE
		        WHEN rm.stock = 0 THEN i.actual_stock <> 0
		        ELSE abs(i.actual_stock - rm.stock) / abs(rm.stock) > ?
		          OR abs((i.actual_stock - rm.stock) * rm.cost_per_unit) > ?
		    END
		FROM raw_materials rm
		WHERE i.raw_material_id = rm.id AND i.session_id = ?
	`, domain.OpnameFraudRatio, domain.OpnameFraudThreshold, sessionID).Error; err != nil {
		return err
	}

	// 3. Pindahkan status. Klausa `status = 'DRAFT'` membuat penguncian ganda
	//    tidak berpengaruh: sesi yang sudah terkunci tidak terkena UPDATE ini,
	//    sehingga `locked_at` tidak pernah mundur atau maju setelah ditetapkan.
	res := db.WithContext(ctx).Exec(`
		UPDATE opname_sessions
		SET status = ?, locked_at = ?
		WHERE id = ? AND status = ?
	`, domain.OpnameStatusLocked, lockedAt, sessionID, domain.OpnameStatusDraft)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname sudah terkunci atau tidak ditemukan")
	}
	return nil
}

func (r *opnameSessionRepository) UpdateStatus(ctx context.Context, sessionID, status string, approvedBy *string, approvedAt *time.Time) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Exec(`
		UPDATE opname_sessions
		SET status = ?, approved_by = ?, approved_at = ?
		WHERE id = ? AND status = ?
	`, status, approvedBy, approvedAt, sessionID, domain.OpnameStatusLocked)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname tidak berstatus LOCKED")
	}
	return nil
}

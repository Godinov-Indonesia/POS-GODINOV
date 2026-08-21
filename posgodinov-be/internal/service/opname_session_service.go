package service

import (
	"context"
	"errors"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

// ErrOpnameAlreadyLocked dipetakan handler menjadi `409 OPNAME_ALREADY_LOCKED`.
//
// Sengaja berupa sentinel, bukan string yang dicocokkan: pesan galat berubah
// setiap kali ada yang memperbaikinya, dan pemetaan status HTTP yang bergantung
// pada teks akan diam-diam berhenti bekerja.
var (
	ErrOpnameAlreadyLocked = errors.New("sesi opname sudah terkunci")
	ErrOpnameNotLocked     = errors.New("sesi opname belum terkunci")
	ErrOpnameForbidden     = errors.New("sesi opname bukan milik outlet ini")
)

type opnameSessionService struct {
	repo       domain.OpnameSessionRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	opnameRepo domain.StockOpnameRepository
	txManager  database.TransactionManager
	now        func() time.Time
}

// NewOpnameSessionService merakit layanan sesi opname ([11 §M16.3]).
func NewOpnameSessionService(
	repo domain.OpnameSessionRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	opnameRepo domain.StockOpnameRepository,
	txManager database.TransactionManager,
) domain.OpnameSessionService {
	return &opnameSessionService{
		repo:       repo,
		rmRepo:     rmRepo,
		outletRepo: outletRepo,
		opnameRepo: opnameRepo,
		txManager:  txManager,
		now:        time.Now,
	}
}

/* ── Kepemilikan ──────────────────────────────────────────────────────────── */

// assertOutlet memastikan outlet benar-benar milik bisnis pemanggil.
//
// Dipanggil di SETIAP metode publik, tanpa kecuali. Satu metode yang lupa
// memanggilnya membuat siapa pun yang punya token sah dapat membaca opname
// bisnis lain hanya dengan mengganti satu segmen URL.
func (s *opnameSessionService) assertOutlet(ctx context.Context, businessID, outletID string) error {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}
	return nil
}

// loadSession mengambil sesi dan memverifikasi ia milik outlet yang diminta.
func (s *opnameSessionService) loadSession(ctx context.Context, businessID, outletID, sessionID string) (*domain.OpnameSession, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}

	session, err := s.repo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	// Diperiksa terhadap OUTLET, bukan hanya bisnis: satu bisnis dapat memiliki
	// banyak outlet, dan opname gudang cabang A tidak boleh terbaca dari URL
	// cabang B.
	if session.OutletID != outletID || session.BusinessID != businessID {
		return nil, ErrOpnameForbidden
	}
	return session, nil
}

/* ── Create ───────────────────────────────────────────────────────────────── */

// Create membuka sesi opname baru berstatus DRAFT.
//
// ⚠️ **Tidak menyentuh `raw_materials` sama sekali.** Godaan terbesar di sini
// adalah mengambil snapshot stok saat sesi dibuat — dan itu akan menghasilkan
// selisih yang salah untuk setiap bahan yang terjual selama penghitungan
// berlangsung. Opname gudang berlangsung berjam-jam; toko tetap berjualan
// selama itu. Snapshot diambil di [Lock], tidak lebih awal.
func (s *opnameSessionService) Create(
	ctx context.Context,
	businessID, outletID, deviceID, countedBy string,
	req *domain.CreateOpnameSessionRequest,
) (*domain.OpnameSession, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}

	scope := req.Scope
	if scope == "" {
		scope = domain.OpnameScopeFull
	}
	if scope != domain.OpnameScopeFull &&
		scope != domain.OpnameScopeCategory &&
		scope != domain.OpnameScopePartial {
		return nil, errors.New("scope opname tidak dikenal")
	}

	// UUID dibuat KLIEN (aturan R2). Yang kosong dibuatkan di sini supaya klien
	// web sederhana tetap dapat memakai endpoint ini; klien lapangan selalu
	// mengirimkan miliknya sendiri agar pengiriman ulang bersifat idempoten.
	id := req.ID
	if id == "" {
		id = utils.NewUUID()
	}

	clientCreatedAt := req.ClientCreatedAt
	if clientCreatedAt.IsZero() {
		clientCreatedAt = s.now().UTC()
	}

	if deviceID == "" {
		deviceID = domain.LegacyDeviceID
	}

	session := &domain.OpnameSession{
		ID:              id,
		OutletID:        outletID,
		BusinessID:      businessID,
		DeviceID:        deviceID,
		Scope:           scope,
		Status:          domain.OpnameStatusDraft,
		CountedBy:       countedBy,
		Notes:           req.Notes,
		ClientCreatedAt: clientCreatedAt,
	}

	if err := s.repo.Create(ctx, session); err != nil {
		return nil, err
	}

	// Dibaca ULANG, bukan dikembalikan apa adanya. `Create` bersifat
	// `DO NOTHING`: bila sesi dengan id ini sudah ada — pengiriman ulang —
	// struct di atas bukan yang tersimpan, dan mengembalikannya akan
	// memberitahu klien bahwa sesinya `DRAFT` padahal mungkin sudah `LOCKED`.
	return s.repo.GetByID(ctx, id)
}

/* ── UpsertItems & GetDraft ───────────────────────────────────────────────── */

// UpsertItems menyimpan hitungan fisik petugas.
//
// Responsnya memakai [domain.OpnameDraftResponse], yang secara harfiah tidak
// memiliki field untuk `system_stock` maupun `difference` — kebocoran di sini
// tidak dapat dikompilasi, bukan sekadar tidak terjadi.
func (s *opnameSessionService) UpsertItems(
	ctx context.Context,
	businessID, outletID, sessionID string,
	reqs []*domain.UpsertOpnameItemRequest,
) (*domain.OpnameDraftResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return nil, err
	}

	// Sesi terkunci tidak menerima hitungan baru. Inilah yang membuat kunci
	// bersifat SATU ARAH: tanpa penjagaan ini, petugas yang melihat selisih
	// dapat "memperbaiki" hitungannya lewat satu permintaan PUT.
	if session.Status != domain.OpnameStatusDraft {
		return nil, ErrOpnameAlreadyLocked
	}

	// Bahan baku dimuat SEKALI untuk seluruh batch, bukan per item. Opname
	// penuh menyentuh ratusan bahan; satu kueri per item mengubahnya menjadi
	// ratusan perjalanan ke basis data.
	catalog, err := s.rawMaterialCatalog(ctx, outletID)
	if err != nil {
		return nil, err
	}

	items := make([]*domain.OpnameSessionItem, 0, len(reqs))
	for _, r := range reqs {
		rm, ok := catalog[r.RawMaterialID]
		if !ok {
			// Bahan yang tidak dikenal DITOLAK, bukan dilewati diam-diam.
			// Hitungan yang hilang tanpa kabar adalah selisih yang muncul
			// entah dari mana saat penguncian.
			return nil, errors.New("bahan baku tidak dikenal pada outlet ini: " + r.RawMaterialID)
		}
		if r.ActualStock < 0 {
			return nil, errors.New("hitungan fisik tidak boleh negatif: " + rm.Name)
		}

		inputType := r.InputType
		if inputType == "" {
			inputType = "base_unit"
		}
		if inputType != "base_unit" && inputType != "package_unit" {
			return nil, errors.New("input_type harus 'base_unit' atau 'package_unit'")
		}

		// Konversi satuan paket → satuan dasar terjadi DI SINI, sekali.
		// Menyimpan angka paket mentah pada `actual_stock` akan membuat
		// selisihnya salah sebesar faktor isi paket — 24× untuk satu dus berisi
		// 24 kaleng.
		actualBase := r.ActualStock
		var actualPackage *float64
		if inputType == "package_unit" {
			if rm.QuantityPerPackage == nil || *rm.QuantityPerPackage <= 0 {
				return nil, errors.New("bahan baku ini tidak memiliki satuan paket: " + rm.Name)
			}
			pkg := r.ActualStock
			actualPackage = &pkg
			actualBase = r.ActualStock * (*rm.QuantityPerPackage)
		} else {
			actualPackage = r.ActualPackageQuantity
		}

		itemID := r.ID
		if itemID == "" {
			itemID = utils.NewUUID()
		}

		items = append(items, &domain.OpnameSessionItem{
			ID:                    itemID,
			SessionID:             sessionID,
			RawMaterialID:         r.RawMaterialID,
			ActualStock:           actualBase,
			ActualPackageQuantity: actualPackage,
			InputType:             inputType,
			Notes:                 r.Notes,
		})
	}

	if err := s.repo.UpsertItems(ctx, sessionID, items); err != nil {
		return nil, err
	}

	return s.buildDraft(ctx, session)
}

// GetDraft mengembalikan keadaan sesi TANPA angka ekspektasi.
func (s *opnameSessionService) GetDraft(ctx context.Context, businessID, outletID, sessionID string) (*domain.OpnameDraftResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return nil, err
	}
	return s.buildDraft(ctx, session)
}

func (s *opnameSessionService) buildDraft(ctx context.Context, session *domain.OpnameSession) (*domain.OpnameDraftResponse, error) {
	stored, err := s.repo.ListItems(ctx, session.ID)
	if err != nil {
		return nil, err
	}
	catalog, err := s.rawMaterialCatalog(ctx, session.OutletID)
	if err != nil {
		return nil, err
	}

	out := make([]*domain.OpnameItemDraftDTO, 0, len(stored))
	for _, it := range stored {
		out = append(out, draftDTO(it, catalog[it.RawMaterialID]))
	}

	return &domain.OpnameDraftResponse{
		ID:           session.ID,
		Status:       session.Status,
		Scope:        session.Scope,
		ItemsCounted: len(out),
		Items:        out,
	}, nil
}

/* ── Lock ─────────────────────────────────────────────────────────────────── */

// Lock mengambil snapshot stok sistem, menghitung selisih, lalu mengunci sesi.
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU TRANSAKSI, DAN ITU MENGIKAT
// ═══════════════════════════════════════════════════════════════════════════
//
// Snapshot, perhitungan, dan perpindahan status seluruhnya berada di dalam satu
// transaksi basis data dengan `SELECT … FOR UPDATE` pada `raw_materials`.
// Memisahkannya membuka jendela saat sinkronisasi penjualan memotong stok bahan
// yang sama — dan selisih yang lahir dari jendela itu adalah tuduhan kehilangan
// barang terhadap orang yang tidak melakukannya.
//
// Ini juga satu-satunya metode yang mengembalikan [domain.OpnameItemLockedDTO].
func (s *opnameSessionService) Lock(ctx context.Context, businessID, outletID, sessionID string) (*domain.OpnameLockResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status != domain.OpnameStatusDraft {
		return nil, ErrOpnameAlreadyLocked
	}

	lockedAt := s.now().UTC()

	if err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Seluruh pekerjaan berat ada di repositori: `FOR UPDATE`, snapshot,
		// hitung selisih, dan perpindahan status dalam rangkaian pernyataan yang
		// tidak dapat disela.
		return s.repo.Lock(txCtx, sessionID, lockedAt)
	}); err != nil {
		return nil, err
	}

	return s.buildLocked(ctx, sessionID, domain.OpnameStatusLocked, lockedAt)
}

// GetLocked menyusun layar detail pemilik.
func (s *opnameSessionService) GetLocked(ctx context.Context, businessID, outletID, sessionID string) (*domain.OpnameLockResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return nil, err
	}

	// Sesi DRAFT ditolak bahkan untuk pemilik.
	//
	// Bukan karena pemilik tidak berhak melihat angkanya, melainkan karena
	// angkanya BELUM ADA: `system_stock` masih NULL sampai penguncian. Menyusun
	// respons "lengkap" dari kolom kosong akan menampilkan selisih nol untuk
	// setiap bahan, dan pemilik akan menyimpulkan gudangnya rapi.
	if session.Status == domain.OpnameStatusDraft {
		return nil, ErrOpnameNotLocked
	}

	var lockedAt time.Time
	if session.LockedAt != nil {
		lockedAt = *session.LockedAt
	}
	return s.buildLocked(ctx, sessionID, session.Status, lockedAt)
}

func (s *opnameSessionService) buildLocked(
	ctx context.Context,
	sessionID, status string,
	lockedAt time.Time,
) (*domain.OpnameLockResponse, error) {
	stored, err := s.repo.ListItems(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	session, err := s.repo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	catalog, err := s.rawMaterialCatalog(ctx, session.OutletID)
	if err != nil {
		return nil, err
	}

	items := make([]*domain.OpnameItemLockedDTO, 0, len(stored))
	summary := domain.OpnameLockSummary{ItemsCounted: len(stored)}

	for _, it := range stored {
		diff := deref(it.Difference)
		value := deref(it.DifferenceValue)

		// Selisih NOL bukan varians. Menghitungnya sebagai varians akan membuat
		// `items_with_variance` selalu sama dengan `items_counted`, dan
		// angkanya berhenti berarti apa pun.
		if diff != 0 {
			summary.ItemsWithVariance++
		}
		summary.TotalVarianceValue += value

		items = append(items, &domain.OpnameItemLockedDTO{
			OpnameItemDraftDTO:    *draftDTO(it, catalog[it.RawMaterialID]),
			SystemStock:           deref(it.SystemStock),
			SystemPackageQuantity: it.SystemPackageQuantity,
			Difference:            diff,
			DifferenceValue:       value,
			FraudFlag:             it.FraudFlag,
		})
	}

	summary.TotalVarianceValue = round2(summary.TotalVarianceValue)

	return &domain.OpnameLockResponse{
		Status:   status,
		LockedAt: lockedAt,
		Summary:  summary,
		Items:    items,
	}, nil
}

/* ── Approve & Reject ─────────────────────────────────────────────────────── */

// Approve menerapkan penyesuaian stok hasil opname.
//
// ═══════════════════════════════════════════════════════════════════════════
// SELISIH DITAMBAHKAN KE STOK BERJALAN — BUKAN MENIMPANYA
// ═══════════════════════════════════════════════════════════════════════════
//
//	stok_baru = stok_saat_ini + difference
//	          = stok_saat_ini + (actual_stock − system_stock_saat_lock)
//
// BUKAN `stok_baru = actual_stock`. Keduanya menghasilkan angka yang sama bila
// tidak ada apa pun terjadi di antara penguncian dan penyetujuan — dan berbeda
// justru pada kasus yang lazim, karena pemilik sering menyetujui keesokan
// harinya sementara toko terus berjualan.
//
// Contoh yang membuat perbedaannya konkret:
//
//	sistem saat lock : 100 kg
//	hitungan fisik   :  95 kg   → difference = −5 (susut 5 kg)
//	terjual sesudah  :  20 kg   → stok saat ini = 80 kg
//
//	  benar  : 80 + (−5) = 75 kg   ← kenyataan fisik
//	  salah  : = actual  = 95 kg   ← menghidupkan kembali 20 kg yang sudah terjual
//
// Menimpa dengan `actual_stock` membuat bahan yang sudah benar-benar terpakai
// muncul kembali di persediaan. Kesalahannya tidak berhenti di angka stok: BOM
// akan memotong dari saldo yang tidak ada, dan opname berikutnya melaporkan
// susut sebesar penjualan sela itu — tuduhan kehilangan barang terhadap orang
// yang tidak melakukannya.
//
// `difference` dipakai apa adanya dari snapshot penguncian. Ia adalah temuan
// opname — selisih antara apa yang ada dan apa yang seharusnya ada PADA MOMEN
// ITU — dan temuan itu tetap sah berapa pun banyaknya penjualan sesudahnya.
//
// ⚠️ Penyetujuan dua kali menghasilkan galat, bukan penyesuaian ganda:
// `UpdateStatus` hanya mengenai baris berstatus `LOCKED`, dan ia dijalankan di
// dalam transaksi yang sama dengan penyesuaiannya. Sifat itu JAUH lebih penting
// pada rumus ini daripada pada `= actual_stock`: penambahan yang terjadi dua
// kali menggandakan selisihnya, sedangkan penimpaan yang terjadi dua kali
// menghasilkan nilai yang sama.
func (s *opnameSessionService) Approve(ctx context.Context, businessID, outletID, sessionID, approvedBy string) (*domain.OpnameApproveResult, error) {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status != domain.OpnameStatusLocked {
		return nil, ErrOpnameNotLocked
	}

	approvedAt := s.now().UTC()
	result := &domain.OpnameApproveResult{
		SessionID: sessionID,
		Status:    domain.OpnameStatusApproved,
	}

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// ── Perpindahan status DULU ──────────────────────────────────────
		//
		// Urutan ini yang menegakkan idempotensi. `UpdateStatus` hanya mengenai
		// baris berstatus `LOCKED`; panggilan kedua tidak menemukan baris dan
		// gagal SEBELUM satu pun stok tersentuh.
		//
		// Urutan sebaliknya — sesuaikan stok lalu pindahkan status — membuat dua
		// permintaan bersamaan sama-sama lolos pemeriksaan awal dan menerapkan
		// penyesuaian dua kali.
		if updErr := s.repo.UpdateStatus(txCtx, sessionID, domain.OpnameStatusApproved, &approvedBy, &approvedAt); updErr != nil {
			return ErrOpnameNotLocked
		}

		items, itemsErr := s.repo.ListItems(txCtx, sessionID)
		if itemsErr != nil {
			return itemsErr
		}

		for _, it := range items {
			// Item tanpa snapshot berarti penguncian tidak menyentuhnya — mis.
			// bahan baku yang dihapus di antara penghitungan dan penguncian.
			// Melewatinya lebih benar daripada menyetel stok ke nol.
			if it.SystemStock == nil {
				continue
			}

			// `LockByID` — `SELECT … FOR UPDATE`. WAJIB, dan bukan sekadar
			// kehati-hatian: rumus di bawah adalah baca-ubah-tulis, dan tanpa
			// kunci baris, sinkronisasi penjualan yang tiba di antara pembacaan
			// dan penulisan akan tertimpa tanpa jejak.
			rm, rmErr := s.rmRepo.LockByID(txCtx, it.RawMaterialID)
			if rmErr != nil {
				continue
			}

			// `rm.Stock` dibaca DI DALAM transaksi dan setelah baris terkunci —
			// itulah "stok saat ini" yang dimaksud rumus di atas, bukan
			// `system_stock` dari snapshot penguncian.
			adjusted := rm.Stock + deref(it.Difference)

			// Stok BOLEH menjadi negatif, sama seperti pada jalur BOM
			// ([11 §M13.6]). Memaksanya berhenti di nol berarti menyembunyikan
			// selisih yang justru harus dilihat pemilik pada opname berikutnya.
			if updErr := s.rmRepo.UpdateStock(txCtx, rm.ID, adjusted); updErr != nil {
				return updErr
			}

			// Projection ke `stock_opnames` agar laporan v1 pemilik tetap hidup
			// selama jendela deprekasi ([11 §3.2]).
			projection := &domain.StockOpname{
				ID:                    utils.NewUUID(),
				OutletID:              outletID,
				RawMaterialID:         it.RawMaterialID,
				SystemStock:           deref(it.SystemStock),
				ActualStock:           it.ActualStock,
				Difference:            deref(it.Difference),
				DifferenceValue:       deref(it.DifferenceValue),
				FraudFlag:             it.FraudFlag,
				RecordedBy:            session.CountedBy,
				InputType:             it.InputType,
				SystemPackageQuantity: deref(it.SystemPackageQuantity),
				ActualPackageQuantity: deref(it.ActualPackageQuantity),
				Notes:                 it.Notes,
				CreatedAt:             approvedAt,
			}
			if projErr := s.opnameRepo.Create(txCtx, projection); projErr != nil {
				return projErr
			}

			result.ItemsAdjusted++
			result.TotalVariance += deref(it.DifferenceValue)
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	result.TotalVariance = round2(result.TotalVariance)
	return result, nil
}

// Reject menutup sesi tanpa menyentuh stok sama sekali.
//
// Sesi yang ditolak TIDAK kembali ke `DRAFT`. Hitung ulang menempuh sesi BARU
// dengan `recount_of` — mengizinkan sesi terkunci dibuka kembali akan
// mengembalikan persis lubang yang penguncian satu arah tutup.
func (s *opnameSessionService) Reject(ctx context.Context, businessID, outletID, sessionID, rejectedBy string) error {
	session, err := s.loadSession(ctx, businessID, outletID, sessionID)
	if err != nil {
		return err
	}
	if session.Status != domain.OpnameStatusLocked {
		return ErrOpnameNotLocked
	}

	rejectedAt := s.now().UTC()
	return s.repo.UpdateStatus(ctx, sessionID, domain.OpnameStatusRejected, &rejectedBy, &rejectedAt)
}

func (s *opnameSessionService) ListSessions(ctx context.Context, businessID, outletID, status string, limit, offset int) ([]*domain.OpnameSession, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.ListByOutlet(ctx, outletID, status, limit, offset)
}

/* ── Pembantu ─────────────────────────────────────────────────────────────── */

func (s *opnameSessionService) rawMaterialCatalog(ctx context.Context, outletID string) (map[string]*domain.RawMaterial, error) {
	list, err := s.rmRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*domain.RawMaterial, len(list))
	for _, rm := range list {
		out[rm.ID] = rm
	}
	return out, nil
}

// draftDTO menyusun bentuk yang aman dikirim selama DRAFT.
//
// Menerima `rm` yang boleh `nil`: bahan baku dapat dihapus pemilik setelah
// dihitung, dan hitungan yang sudah terjadi tidak boleh lenyap dari daftar
// karena katalognya berubah.
func draftDTO(it *domain.OpnameSessionItem, rm *domain.RawMaterial) *domain.OpnameItemDraftDTO {
	dto := &domain.OpnameItemDraftDTO{
		RawMaterialID:         it.RawMaterialID,
		ActualStock:           it.ActualStock,
		ActualPackageQuantity: it.ActualPackageQuantity,
		InputType:             it.InputType,
		Notes:                 it.Notes,
	}
	if rm != nil {
		dto.RawMaterialName = rm.Name
		dto.Unit = rm.Unit
		dto.PackageUnit = rm.PackageUnit
		dto.QuantityPerPackage = rm.QuantityPerPackage
	} else {
		dto.RawMaterialName = "(bahan baku sudah dihapus)"
	}
	return dto
}

func deref(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

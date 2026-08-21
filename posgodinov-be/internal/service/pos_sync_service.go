package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type posSyncService struct {
	staffRepo    domain.StaffRepository
	categoryRepo domain.ProductCategoryRepository
	productRepo  domain.ProductRepository
	posRepo      domain.POSRepository
	rawMatRepo   domain.RawMaterialRepository
	txManager    database.TransactionManager

	// Penelusuran BOM hidup di SATU tempat ([11 §M13.6]); penjualan, void, dan
	// retur memakai implementasi yang sama persis.
	stock bomStockAdjuster

	// ── Repositori v2 (Fase M11.2) ──────────────────────────────────────────
	//
	// Seluruhnya BOLEH nil. Server yang basis datanya belum dimigrasi tetap
	// melayani kontrak v1 sepenuhnya, dan entitas v2 dilaporkan gagal dengan
	// alasan yang jujur alih-alih membuat proses panik. Ini yang membuat urutan
	// rilis M18.2 mungkin: backend baru dapat naik lebih dulu, sendirian.
	paymentRepo       domain.TransactionPaymentRepository
	voidLogRepo       domain.VoidLogRepository
	securityEventRepo domain.SecurityEventRepository
	masterVersionRepo domain.MasterVersionRepository

	// Aturan retur hidup di layanannya sendiri ([11 §M13.6]); lapisan sync
	// hanya meneruskan payload dan menerjemahkan galatnya.
	returnService domain.ReturnService

	// Rekonsiliasi shift hidup di layanannya sendiri ([11 §M15.3]).
	shiftReconcile domain.ShiftReconcileService
}

func NewPOSSyncService(
	staffRepo domain.StaffRepository,
	categoryRepo domain.ProductCategoryRepository,
	productRepo domain.ProductRepository,
	posRepo domain.POSRepository,
	rawMatRepo domain.RawMaterialRepository,
	txManager database.TransactionManager,
	opts ...POSSyncOption,
) domain.POSSyncService {
	svc := &posSyncService{
		staffRepo:    staffRepo,
		categoryRepo: categoryRepo,
		productRepo:  productRepo,
		posRepo:      posRepo,
		rawMatRepo:   rawMatRepo,
		txManager:    txManager,
		stock:        bomStockAdjuster{productRepo: productRepo, rawMatRepo: rawMatRepo},
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// POSSyncOption menyuntikkan repositori v2 tanpa memecah pemanggil v1.
//
// Konstruktor variadic dipilih ketimbang menambah enam parameter wajib: uji dan
// kode pemanggil yang hanya peduli jalur v1 tetap terkompilasi apa adanya,
// sehingga perubahan kontrak ini tidak menyebar ke berkas yang tidak ada
// urusannya dengan v2.
type POSSyncOption func(*posSyncService)

func WithPaymentRepository(r domain.TransactionPaymentRepository) POSSyncOption {
	return func(s *posSyncService) { s.paymentRepo = r }
}

func WithReturnService(r domain.ReturnService) POSSyncOption {
	return func(s *posSyncService) { s.returnService = r }
}

func WithVoidLogRepository(r domain.VoidLogRepository) POSSyncOption {
	return func(s *posSyncService) { s.voidLogRepo = r }
}

func WithSecurityEventRepository(r domain.SecurityEventRepository) POSSyncOption {
	return func(s *posSyncService) { s.securityEventRepo = r }
}

func WithMasterVersionRepository(r domain.MasterVersionRepository) POSSyncOption {
	return func(s *posSyncService) { s.masterVersionRepo = r }
}

func WithShiftReconcileService(r domain.ShiftReconcileService) POSSyncOption {
	return func(s *posSyncService) { s.shiftReconcile = r }
}

func (s *posSyncService) GetMasterData(ctx context.Context, businessID, outletID string) (*domain.SyncMasterDataResponse, error) {
	// Peringatan: Kita harus memastikan Outlet ini benar milik BusinessID yang melakukan request.
	// Namun pengecekan ownership ini idealnya dilakukan di middleware/handler menggunakan token.
	
	staffs, err := s.staffRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data staf")
	}

	categories, err := s.categoryRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data kategori")
	}

	products, err := s.productRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data produk")
	}

	var posStaffs []*domain.POSMasterStaff
	for _, s := range staffs {
		posStaffs = append(posStaffs, &domain.POSMasterStaff{
			ID:              s.ID,
			StaffIdentifier: s.StaffIdentifier,
			Name:            s.Name,
			PINHash:         s.PINHash,
			// v2 — otorisasi harus dapat diputuskan OFFLINE ([11 §4.4]).
			Role:        s.Role,
			Permissions: s.Permissions,
		})
	}

	var posCategories []*domain.POSMasterCategory
	for _, c := range categories {
		posCategories = append(posCategories, &domain.POSMasterCategory{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
		})
	}

	var posProducts []*domain.POSMasterProduct
	for _, p := range products {
		posProducts = append(posProducts, &domain.POSMasterProduct{
			ID:         p.ID,
			Name:       p.Name,
			Price:      p.Price,
			ImageURL:   p.ImageURL,
			CategoryID: p.CategoryID,
		})
	}

	// Versi master data (butir 10). Server yang belum dimigrasi mengembalikan 0,
	// dan gerbang Buka Shift memperlakukan 0 sebagai "belum ada penomoran" —
	// bukan sebagai kegagalan yang menghalangi kasir membuka laci.
	var version int64
	if s.masterVersionRepo != nil {
		if v, verr := s.masterVersionRepo.Get(ctx, outletID); verr == nil {
			version = v
		}
	}

	return &domain.SyncMasterDataResponse{
		Version:    version,
		Staffs:     posStaffs,
		Categories: posCategories,
		Products:   posProducts,
		// ⚠️ Payload ini SENGAJA tidak memuat stok apa pun. Butir 3 gugur
		// seketika bila stok sistem hadir di perangkat kasir atau opname.
		Config: domain.DefaultPOSConfig(),
	}, nil
}

// SyncUp memproses satu batch sinkronisasi ([11 §4.2]).
//
// # Urutan pemrosesan MENGIKAT
//
//	Shifts -> Transactions -> Returns -> VoidLogs -> Wastes -> SecurityEvents
//
// Bukan selera: setiap tahap merujuk hasil tahap sebelumnya. Transaksi memiliki
// FK ke shift; retur merujuk transaksi; log pembatalan dapat merujuk keduanya.
// Memproses retur sebelum transaksi induknya tiba menghasilkan kegagalan FK
// untuk data yang sebenarnya sah — dan klien akan mengirim ulang selamanya.
//
// # Satu baris gagal tidak menjatuhkan batch
//
// Setiap entitas berjalan di transaksi basis datanya sendiri. Sebuah retur yang
// cacat tidak boleh membatalkan 200 penjualan yang uangnya sudah diterima.
func (s *posSyncService) SyncUp(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2) (*domain.SyncUpResponse, error) {
	resp := &domain.SyncUpResponse{
		FailedTransactions: make([]string, 0),
	}

	s.syncShifts(ctx, businessID, outletID, req, resp)
	s.syncTransactions(ctx, businessID, outletID, req, resp)
	s.syncReturns(ctx, businessID, outletID, req, resp)
	s.syncVoidLogs(ctx, businessID, outletID, req, resp)
	s.syncWastes(ctx, businessID, outletID, req, resp)
	s.syncSecurityEvents(ctx, businessID, outletID, req, resp)

	// Klien membandingkan angka ini dengan versi yang dipegangnya untuk tahu
	// bahwa master data-nya kedaluwarsa, tanpa perlu permintaan terpisah.
	if s.masterVersionRepo != nil {
		if v, err := s.masterVersionRepo.Get(ctx, outletID); err == nil {
			resp.MasterDataVersion = v
		}
	}

	return resp, nil
}

/* ── 1. Shift ─────────────────────────────────────────────────────────────── */

func (s *posSyncService) syncShifts(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, shift := range req.Shifts {
		shift.BusinessID = businessID
		shift.OutletID = outletID
		if shift.DeviceID == "" {
			shift.DeviceID = fallbackDeviceID(req.DeviceID)
		}

		// ATURAN R4 — angka ekspektasi DIHITUNG SERVER, tidak pernah diterima
		// dari klien. Tag `json:"-"` sudah membuang kunci ini saat dekode;
		// pengosongan di sini menutup jalur kedua: pemanggil internal yang
		// mengisi struct secara langsung.
		//
		// Nilainya diisi `ShiftReconcileService` SETELAH baris tersimpan —
		// lihat blok rekonsiliasi di bawah. Membiarkannya nil di sini bukan
		// sekadar kehati-hatian: `SaveShift` tidak memuat kolom ini di daftar
		// DoUpdates-nya, sehingga rekonsiliasi yang sudah tertulis tidak
		// tertimpa nol oleh pengiriman ulang shift yang sama.
		shift.ExpectedCash = nil
		shift.ExpectedEDCTotal = nil
		shift.ExpectedQRISTotal = nil
		shift.CashVariance = nil
		shift.EDCVariance = nil
		shift.QRISVariance = nil
		shift.ReconciledAt = nil

		// Kembar v1-nya ikut dinolkan, dan itu BUKAN kehati-hatian berlebih.
		//
		// `expected_balance` dan `discrepancy` masih membawa tag JSON aktif demi
		// klien v1, sehingga dekoder MENERIMA keduanya dari perangkat. Daftar
		// DoUpdates `SaveShift` memang tidak memuatnya, tetapi pengiriman
		// PERTAMA sebuah shift adalah INSERT — dan pada INSERT seluruh kolom
		// struct ikut tertulis. Tanpa baris ini, klien yang dimodifikasi cukup
		// mengirim `expected_balance: 1` saat membuka shift dan angkanya
		// menetap di basis data sampai shift itu ditutup.
		//
		// Keduanya diisi ulang `UpdateShiftReconciliation` dengan hasil hitung
		// server selama jendela deprekasi M18.
		shift.ExpectedBalance = 0
		shift.Discrepancy = 0

		// ── BUTIR 10 — gerbang master data, ditegakkan server ───────────────
		//
		// `ck_shift_master_version` di basis data menangkap hal yang sama,
		// tetapi kegagalannya tiba sebagai galat Postgres mentah yang tidak
		// memberi tahu kasir apa pun. Pemeriksaan di sini mengubahnya menjadi
		// pesan yang dapat ditindaklanjuti, dan menahannya sebelum baris
		// menyentuh basis data.
		//
		// Perangkat `legacy` dikecualikan — sama seperti CHECK-nya — karena
		// shift v1 lahir sebelum gerbang ini ada.
		if shift.Status == domain.ShiftStatusOpen &&
			shift.DeviceID != domain.LegacyDeviceID &&
			shift.MasterDataVersion == nil {
			resp.AddError(domain.EntityShift, shift.ID, domain.ErrCodeMasterDataRequired,
				"shift dibuka tanpa versi master data; tarik master data lalu buka shift ulang", false)
			continue
		}

		if err := s.posRepo.SaveShift(ctx, shift); err != nil {
			// Indeks unik parsial `uq_shift_open_per_device`/`_per_staff`
			// (butir 12) mendarat di sini. Kegagalannya PERMANEN: mengirim
			// ulang tidak akan membuat shift lain tertutup dengan sendirinya,
			// jadi barisnya dikarantina agar tidak memblokir antrean.
			resp.AddError(domain.EntityShift, shift.ID, domain.ErrCodeShiftOpenOnDevice,
				"shift gagal disimpan: "+err.Error(), false)
			continue
		}
		// ── BUTIR 9 — rekonsiliasi, SETELAH baris tersimpan ─────────────────
		//
		// Hanya untuk shift yang sudah ditutup: shift `OPEN` masih menerima
		// transaksi, dan angka ekspektasinya akan basi sebelum sempat dibaca
		// siapa pun.
		//
		// Urutannya penting. Rekonsiliasi membaca `declared_*` dari BARIS YANG
		// SUDAH TERSIMPAN, bukan dari struct kiriman — sehingga ia menghitung
		// terhadap angka yang benar-benar tercatat, bukan terhadap salinan yang
		// mungkin belum melewati upsert.
		if shift.Status == domain.ShiftStatusClosed && s.shiftReconcile != nil {
			if _, err := s.shiftReconcile.Reconcile(ctx, shift.ID); err != nil {
				// `retryable: true` — berbeda dari seluruh kegagalan lain di
				// blok ini. Baris shift-nya SUDAH tersimpan lengkap dengan
				// ketiga angka deklarasi kasir; yang belum ada hanyalah hitungan
				// server. `Reconcile` maupun `SaveShift` sama-sama idempoten,
				// sehingga pengiriman ulang benar-benar dapat berhasil tanpa
				// apa pun berubah di perangkat.
				//
				// `ShiftsSynced` sengaja TIDAK dinaikkan: menaikkannya sambil
				// melaporkan galat untuk id yang sama membuat respons
				// bertentangan dengan dirinya sendiri, dan klien yang membaca
				// hitungan agregat — jalur v1 — akan menyimpulkan sebaliknya
				// dari klien yang membaca galat per-id.
				resp.AddError(domain.EntityShift, shift.ID, domain.ErrCodePersistFailed,
					"rekonsiliasi shift tertunda: "+err.Error(), true)
				continue
			}
		}

		resp.ShiftsSynced++
	}
}

/* ── 2. Transaksi ─────────────────────────────────────────────────────────── */

func (s *posSyncService) syncTransactions(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, trx := range req.Transactions {
		trx.BusinessID = businessID
		trx.OutletID = outletID
		if trx.DeviceID == "" {
			trx.DeviceID = fallbackDeviceID(req.DeviceID)
		}
		// Agregat retur DIHITUNG SERVER dari tabel `returns` (M13.6). Nilai
		// kiriman klien hanya cache tampilan dan tidak boleh dipercaya.
		trx.ReturnState = domain.ReturnStateNone

		payments, verr := s.prepareTenders(trx)
		if verr != nil {
			resp.AddError(domain.EntityTransaction, trx.ID, tenderErrorCode(verr), verr.Error(), false)
			continue
		}

		err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
			existingTrx, err := s.posRepo.GetTransactionByID(txCtx, trx.ID)
			if err == nil && existingTrx != nil {
				// BUTIR 15 — transaksi yang struknya SUDAH terbit tidak dapat
				// di-void; jalurnya adalah Retur. Basis data juga menolaknya
				// lewat `ck_void_requires_unprinted`, tetapi menangkapnya di
				// sini menghasilkan pesan yang dapat dibaca kasir alih-alih
				// galat constraint mentah.
				if domain.IsCancellation(trx.Status) && existingTrx.ReceiptPrintedAt != nil {
					return domain.NewSyncFieldError("status",
						"transaksi yang struknya sudah tercetak tidak dapat di-void; gunakan alur Retur")
				}
				if existingTrx.Status == domain.TxStatusCompleted && domain.IsCancellation(trx.Status) {
					return s.handleCancelTransaction(txCtx, trx)
				}
				return nil // duplikat — idempotensi
			}

			if err := s.posRepo.SaveTransaction(txCtx, trx); err != nil {
				return err
			}
			if err := s.persistTenders(txCtx, trx, payments); err != nil {
				return err
			}

			if trx.Status == domain.TxStatusCompleted {
				return s.deductBOMStock(txCtx, trx, false)
			}
			// Dibatalkan sebelum pernah tersinkron: stok belum pernah dipotong,
			// jadi tidak ada yang perlu dikembalikan.
			return nil
		})

		if err != nil {
			var fieldErr *domain.SyncFieldError
			if errors.As(err, &fieldErr) {
				resp.AddError(domain.EntityTransaction, trx.ID, domain.ErrCodeVoidAfterPrint, fieldErr.Error(), false)
			} else {
				resp.AddError(domain.EntityTransaction, trx.ID, domain.ErrCodePersistFailed, err.Error(), true)
			}
			continue
		}
		resp.TransactionsSynced++
	}
}

// prepareTenders merekonstruksi, memvalidasi, dan menyeimbangkan rincian tender.
//
// Invarian yang ditegakkan: `Σ payments.amount == total_amount`. Ketidakcocokan
// berarti struk mengatakan satu angka sementara laci mengatakan angka lain — dan
// tidak ada cara memutuskan mana yang benar setelah pelanggan pulang.
//
// # Tender yang tidak dapat disimpulkan BUKAN kegagalan
//
// Transaksi bernilai nol, atau bermetode di luar kontrak beku, tidak memiliki
// tender yang dapat direkonstruksi. Menolaknya berarti MEMBUANG PENJUALAN yang
// uangnya sudah diterima hanya karena pembukuan tendernya tidak lengkap —
// pertukaran yang selalu salah arah. Baris seperti itu tersimpan tanpa tender,
// dan `(nil, nil)` menyatakannya kepada pemanggil.
//
// Yang benar-benar fatal hanya dua: nominal tender yang tidak seimbang, dan
// tender kartu yang perangkatnya MENGAKU membawa rincian kartu tetapi ternyata
// tidak.
func (s *posSyncService) prepareTenders(trx *domain.Transaction) ([]*domain.TransactionPayment, error) {
	payments, synthesized := trx.ResolvePayments()
	if len(payments) == 0 {
		return nil, nil
	}

	var sum float64
	for i, p := range payments {
		p.TransactionID = trx.ID
		if p.Sequence == 0 {
			p.Sequence = i + 1
		}
		// `IsReconstructed` hanya boleh ditulis di sini dan oleh migrasi. Tag
		// `json:"-"` sudah membuangnya saat dekode; penetapan eksplisit ini
		// menutup jalur pemanggil internal. Tender yang benar-benar dikirim
		// perangkat SELALU dinilai penuh terhadap butir 8.
		p.IsReconstructed = synthesized

		if err := p.Validate(); err != nil {
			return nil, err
		}
		sum += p.Amount
	}

	// Toleransi satu sen: nominal melintasi batas API sebagai float64 desimal
	// Rupiah, dan pembulatan biner dapat menyisakan selisih sepersekian sen yang
	// bukan kesalahan siapa pun. Selisih yang lebih besar dari itu selalu berarti
	// data yang benar-benar tidak seimbang.
	if diff := sum - trx.TotalAmount; diff > 0.01 || diff < -0.01 {
		return nil, domain.NewSyncFieldError("payments",
			"jumlah tender tidak sama dengan total transaksi")
	}

	return payments, nil
}

// persistTenders menulis baris tender dan ringkasan terdenormalisasi induknya.
func (s *posSyncService) persistTenders(ctx context.Context, trx *domain.Transaction, payments []*domain.TransactionPayment) error {
	if len(payments) == 0 {
		// Tidak ada tender yang dapat disimpulkan; transaksinya sendiri sudah
		// tersimpan. Kolom ringkasan dibiarkan apa adanya — menimpanya dengan
		// nol akan menghapus metode pembayaran penjualan yang sudah terjadi.
		return nil
	}
	if s.paymentRepo == nil {
		// Basis data belum dimigrasi. Transaksinya sendiri sudah tersimpan;
		// menolaknya di sini berarti membuang penjualan yang uangnya sudah
		// diterima hanya karena tabel pendamping belum ada.
		return nil
	}
	if err := s.paymentRepo.SaveMany(ctx, payments); err != nil {
		return err
	}
	return s.paymentRepo.UpdateSummary(ctx, trx.ID, summarizeTenders(payments))
}

// summarizeTenders menghitung kolom ringkasan v1-compat pada `transactions`.
//
// `payment_method` menjadi `SPLIT` HANYA bila benar-benar ada dua tender atau
// lebih untuk menjelaskannya. Transaksi yang mengaku gabungan tanpa satu pun
// baris tender pendukung adalah persis bentuk yang butir 8 hendak cegah.
func summarizeTenders(payments []*domain.TransactionPayment) domain.TenderSummary {
	sum := domain.TenderSummary{TenderCount: len(payments)}

	for _, p := range payments {
		if p.Method == domain.TenderCash {
			sum.CashAmount += p.Amount
		} else {
			sum.NonCashAmount += p.Amount
		}
		// Trace number pertama yang ditemukan menjadi wakil di kolom ringkasan —
		// cukup untuk pencocokan settlement EDC harian, sementara rincian
		// lengkapnya tetap hidup di `transaction_payments`.
		if sum.PrimaryTraceNumber == nil && p.TraceNumber != nil {
			sum.PrimaryTraceNumber = p.TraceNumber
			sum.PrimaryCardLast4 = p.CardLast4
		}
	}

	if len(payments) > 1 {
		sum.PaymentMethod = domain.PaymentSummarySplit
	} else if len(payments) == 1 {
		sum.PaymentMethod = payments[0].Method
	}
	return sum
}

func tenderErrorCode(err error) string {
	var fieldErr *domain.SyncFieldError
	if !errors.As(err, &fieldErr) {
		return domain.ErrCodeInvalidPayload
	}
	switch fieldErr.Field {
	case "payments":
		return domain.ErrCodeTenderMismatch
	case "trace_number", "card_last4":
		return domain.ErrCodeCardDetailsRequired
	default:
		return domain.ErrCodeInvalidTender
	}
}

/* ── 3. Retur ─────────────────────────────────────────────────────────────── */

// syncReturns mendelegasikan SELURUH aturan retur ke [domain.ReturnService].
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU TEMPAT UNTUK ATURANNYA
// ═══════════════════════════════════════════════════════════════════════════
//
// Versi M11.3 memvalidasi retur di sini dengan `checkReturnable`. Aturan yang
// sama kini juga dibutuhkan endpoint `returnable` dan — kelak — layar pemilik.
// Menyalinnya berarti perubahan berikutnya akan mengenai sebagian saja, dan
// yang terlewat adalah tempat retur berlebih lolos.
//
// Lapisan ini tinggal menerjemahkan galat menjadi entri `errors[]`.
func (s *posSyncService) syncReturns(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, ret := range req.Returns {
		if s.returnService == nil {
			resp.AddError(domain.EntityReturn, ret.ID, domain.ErrCodePersistFailed,
				"server belum mendukung retur (basis data belum dimigrasi)", true)
			continue
		}

		if ret.DeviceID == "" {
			ret.DeviceID = fallbackDeviceID(req.DeviceID)
		}

		if err := s.returnService.Create(ctx, businessID, outletID, ret); err != nil {
			var fieldErr *domain.SyncFieldError
			if errors.As(err, &fieldErr) {
				// Cacat bentuk TIDAK PERNAH sembuh dengan mengirim ulang:
				// kuantitas yang melebihi batas akan tetap melebihi pada
				// percobaan keseribu. `retryable: false` memindahkannya ke
				// karantina di klien ([11 §4.3]).
				resp.AddError(domain.EntityReturn, ret.ID, ReturnErrorCode(err), fieldErr.Error(), false)
			} else {
				resp.AddError(domain.EntityReturn, ret.ID, domain.ErrCodePersistFailed, err.Error(), true)
			}
			continue
		}
		resp.ReturnsSynced++
	}
}

/* ── 4. Log pembatalan ────────────────────────────────────────────────────── */

func (s *posSyncService) syncVoidLogs(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, log := range req.VoidLogs {
		if s.voidLogRepo == nil {
			resp.AddError(domain.EntityVoidLog, log.ID, domain.ErrCodePersistFailed,
				"server belum mendukung log pembatalan (basis data belum dimigrasi)", true)
			continue
		}

		log.BusinessID = businessID
		log.OutletID = outletID
		if log.DeviceID == "" {
			log.DeviceID = fallbackDeviceID(req.DeviceID)
		}

		if err := log.Validate(); err != nil {
			resp.AddError(domain.EntityVoidLog, log.ID, domain.ErrCodeInvalidPayload, err.Error(), false)
			continue
		}
		if err := s.voidLogRepo.Save(ctx, log); err != nil {
			resp.AddError(domain.EntityVoidLog, log.ID, domain.ErrCodePersistFailed, err.Error(), true)
			continue
		}
		resp.VoidLogsSynced++
	}
}

/* ── 5. Waste ─────────────────────────────────────────────────────────────── */

func (s *posSyncService) syncWastes(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, waste := range req.Wastes {
		waste.BusinessID = businessID
		waste.OutletID = outletID

		err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
			existingWaste, err := s.posRepo.GetProductWasteByID(txCtx, waste.ID)
			if err == nil && existingWaste != nil {
				return nil // duplikat
			}
			if err := s.posRepo.SaveProductWaste(txCtx, waste); err != nil {
				return err
			}
			return s.deductBOMStockForWaste(txCtx, waste)
		})

		if err != nil {
			resp.AddError(domain.EntityWaste, waste.ID, domain.ErrCodePersistFailed, err.Error(), true)
			continue
		}
		resp.WastesSynced++
	}
}

/* ── 6. Audit keamanan ────────────────────────────────────────────────────── */

// syncSecurityEvents diproses TERAKHIR dan sengaja paling permisif.
//
// Peristiwa keamanan adalah satu-satunya sinyal yang dimiliki pemilik tentang
// apa yang terjadi saat perangkat offline. Menolak sebuah peristiwa karena
// bentuknya kurang rapi berarti menghapus bukti demi kerapian — pertukaran yang
// selalu salah arah. Karena itu `Normalize` memperbaiki apa yang bisa diperbaiki
// alih-alih menolak.
func (s *posSyncService) syncSecurityEvents(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequestV2, resp *domain.SyncUpResponse) {
	for _, event := range req.SecurityEvents {
		if s.securityEventRepo == nil {
			resp.AddError(domain.EntitySecurityEvent, event.ID, domain.ErrCodePersistFailed,
				"server belum mendukung audit keamanan (basis data belum dimigrasi)", true)
			continue
		}

		event.BusinessID = businessID
		event.OutletID = outletID
		if event.DeviceID == "" {
			event.DeviceID = fallbackDeviceID(req.DeviceID)
		}

		if err := event.Normalize(); err != nil {
			resp.AddError(domain.EntitySecurityEvent, event.ID, domain.ErrCodeInvalidPayload, err.Error(), false)
			continue
		}
		if err := s.securityEventRepo.Save(ctx, event); err != nil {
			resp.AddError(domain.EntitySecurityEvent, event.ID, domain.ErrCodePersistFailed, err.Error(), true)
			continue
		}
		resp.SecurityEventsSynced++
	}
}

// fallbackDeviceID memberi identitas pada baris yang datang dari klien v1.
//
// `'legacy'` adalah nilai bawaan kolom di basis data, sehingga baris v1 tetap
// dapat dibedakan dari baris v2 yang membawa identitas perangkat sungguhan.
func fallbackDeviceID(deviceID string) string {
	if deviceID != "" {
		return deviceID
	}
	return domain.LegacyDeviceID
}

func (s *posSyncService) handleCancelTransaction(ctx context.Context, trx *domain.Transaction) error {
	// Reverse Deduction
	if err := s.deductBOMStock(ctx, trx, true); err != nil {
		return err
	}
	
	// Update Status
	return s.posRepo.UpdateTransactionStatus(ctx, trx.ID, "CANCELLED", trx.CancelNotes)
}

// deductBOMStock diteruskan ke [bomStockAdjuster].
//
// Dipertahankan sebagai metode tipis, bukan dihapus, karena inilah nama yang
// dipakai jalur penjualan sejak v1 dan mengganti seluruh pemanggilnya sekaligus
// hanya menambah permukaan perubahan tanpa menambah kejelasan.
func (s *posSyncService) deductBOMStock(ctx context.Context, trx *domain.Transaction, isReverse bool) error {
	if isReverse {
		// VOID mengembalikan stok PENUH: transaksi dinyatakan tidak pernah
		// terjadi, sehingga seluruh bahan bakunya kembali ([11 §M13.6]).
		return s.stock.restoreTransaction(ctx, trx)
	}
	return s.stock.deductTransaction(ctx, trx)
}

func (s *posSyncService) deductBOMStockForWaste(ctx context.Context, waste *domain.ProductWaste) error {
	return s.stock.deductWaste(ctx, waste)
}

func (s *posSyncService) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	if limit <= 0 {
		limit = 50 // default limit
	}
	if limit > 100 {
		limit = 100 // max limit
	}
	
	return s.posRepo.GetTransactions(ctx, outletID, limit, offset)
}

// MinLookupCodeLength menolak pencarian yang terlalu pendek — butir 16
// ([11 §M17.3]).
//
// Enam karakter, bukan tiga. `short_code` diterbitkan cukup panjang untuk
// membedakan transaksi dalam satu outlet; menerima input lebih pendek
// mengundang kasir mengetik dua karakter lalu mencoba satu per satu sampai
// menemukan sesuatu — penelusuran massal yang dilakukan sedikit demi sedikit.
const MinLookupCodeLength = 6

// LookupTransaction — satu transaksi, bukan daftar.
func (s *posSyncService) LookupTransaction(ctx context.Context, outletID, code string) (*domain.Transaction, error) {
	trimmed := strings.TrimSpace(code)
	if len(trimmed) < MinLookupCodeLength {
		return nil, fmt.Errorf("kode pencarian minimal %d karakter", MinLookupCodeLength)
	}
	return s.posRepo.LookupTransaction(ctx, outletID, trimmed)
}

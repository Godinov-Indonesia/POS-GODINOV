package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

// returnService menegakkan seluruh aturan retur — **butir 15** ([11 §M13.6]).
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU TRANSAKSI BASIS DATA, EMPAT AKIBAT
// ═══════════════════════════════════════════════════════════════════════════
//
// Sebuah retur menyentuh empat tempat sekaligus:
//
//  1. `returns` + `return_items` — catatan peristiwanya;
//  2. `raw_materials.stock` — barang yang benar-benar kembali;
//  3. `product_wastes` — barang yang TIDAK kembali, beserta alasannya;
//  4. `transactions.return_state` — agregat yang dibaca layar dan laporan.
//
// Keempatnya berada dalam SATU transaksi basis data. Bila hanya sebagian yang
// tersimpan, hasilnya adalah bentuk kerusakan yang paling mahal: stok bertambah
// tanpa catatan retur yang menjelaskannya, atau retur tercatat tanpa barangnya
// pernah kembali. Keduanya baru terlihat saat opname, ketika sudah terlambat
// untuk menelusuri siapa yang menyentuh apa.
type returnService struct {
	returnRepo domain.ReturnRepository
	posRepo    domain.POSRepository
	stock      bomStockAdjuster
	txManager  database.TransactionManager
	now        func() time.Time
	newID      func() string
}

// NewReturnService merakit layanan retur.
//
// [now] dan [newID] dapat disuntik agar uji tidak bergantung pada jam dinding
// maupun keacakan — dua sumber kegagalan uji yang paling sering dan paling
// membingungkan.
func NewReturnService(
	returnRepo domain.ReturnRepository,
	posRepo domain.POSRepository,
	productRepo domain.ProductRepository,
	rawMatRepo domain.RawMaterialRepository,
	txManager database.TransactionManager,
	opts ...ReturnServiceOption,
) domain.ReturnService {
	svc := &returnService{
		returnRepo: returnRepo,
		posRepo:    posRepo,
		stock:      bomStockAdjuster{productRepo: productRepo, rawMatRepo: rawMatRepo},
		txManager:  txManager,
		now:        time.Now,
		newID:      utils.NewUUID,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

type ReturnServiceOption func(*returnService)

func WithReturnClock(now func() time.Time) ReturnServiceOption {
	return func(s *returnService) { s.now = now }
}

func WithReturnIDGenerator(gen func() string) ReturnServiceOption {
	return func(s *returnService) { s.newID = gen }
}

/* ── Create ───────────────────────────────────────────────────────────────── */

func (s *returnService) Create(ctx context.Context, businessID, outletID string, ret *domain.Return) error {
	ret.BusinessID = businessID
	ret.OutletID = outletID

	if err := ret.Validate(); err != nil {
		return err
	}

	return s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// ── Idempotensi ──────────────────────────────────────────────────
		//
		// Diperiksa DI DALAM transaksi. Di luar, dua pengiriman ulang yang tiba
		// bersamaan sama-sama melihat "belum ada" lalu keduanya menyisipkan —
		// dan stok bertambah dua kali untuk barang yang sama.
		if existing, err := s.returnRepo.GetByID(txCtx, ret.ID); err == nil && existing != nil {
			return nil
		}

		original, err := s.posRepo.GetTransactionByID(txCtx, ret.OriginalTransactionID)
		if err != nil || original == nil {
			return domain.NewSyncFieldError("original_transaction_id",
				"transaksi asal tidak ditemukan di server")
		}

		// ── BUTIR 15 — retur hanya untuk transaksi yang struknya SUDAH terbit ─
		//
		// Transaksi yang belum tercetak belum menjadi dokumen; jalurnya Void.
		// Menerima retur untuknya berarti menerbitkan catatan pengembalian atas
		// penjualan yang masih boleh dinyatakan tidak pernah terjadi.
		if original.ReceiptPrintedAt == nil {
			return domain.NewSyncFieldError("original_transaction_id",
				"struk transaksi asal belum pernah terbit; gunakan alur Void, bukan Retur")
		}

		if domain.IsCancellation(original.Status) {
			return domain.NewSyncFieldError("original_transaction_id",
				"transaksi asal sudah dibatalkan; tidak ada yang dapat diretur")
		}

		// ── Kunci + baca batas ───────────────────────────────────────────
		snapshot, err := s.returnRepo.SnapshotForReturn(txCtx, ret.OriginalTransactionID)
		if err != nil {
			return err
		}
		if err := validateAgainstSnapshot(ret, snapshot); err != nil {
			return err
		}

		// ── Simpan ───────────────────────────────────────────────────────
		if ret.ClientCreatedAt.IsZero() {
			ret.ClientCreatedAt = s.now().UTC()
		}
		if err := s.returnRepo.Save(txCtx, ret); err != nil {
			return err
		}

		// ── Gerakkan stok & catat pembuangan ─────────────────────────────
		if err := s.applyStockMovement(txCtx, ret); err != nil {
			return err
		}

		// ── Hitung ulang agregat ─────────────────────────────────────────
		//
		// Snapshot yang dibaca di atas diambil SEBELUM retur ini tersimpan,
		// sehingga tidak dapat dipakai langsung. Menambahkan kuantitas retur ini
		// ke atasnya lebih murah daripada membaca ulang, dan hasilnya identik
		// karena barisnya masih terkunci — tidak ada yang bisa menyisip.
		return s.returnRepo.UpdateReturnState(
			txCtx,
			ret.OriginalTransactionID,
			deriveStateAfter(snapshot, ret),
		)
	})
}

// validateAgainstSnapshot menegakkan `Σ return_items.quantity ≤ qty asal`
// ([11 §3.4]).
//
// Snapshot-nya berasal dari baris yang sedang TERKUNCI, sehingga angka yang
// dibandingkan di sini tidak dapat berubah sampai transaksi ini selesai. Tanpa
// kunci itu, pemeriksaan ini hanya menghasilkan rasa aman palsu terhadap dua
// retur yang tiba bersamaan.
func validateAgainstSnapshot(ret *domain.Return, snapshot *domain.ReturnSnapshot) error {
	limits := snapshot.ByItemID()

	// Kuantitas dijumlahkan LEBIH DULU per baris: satu payload retur dapat
	// memuat `transaction_item_id` yang sama dua kali, dan memeriksanya
	// satu-per-satu akan meloloskan 2 + 2 terhadap batas 3.
	requested := make(map[string]int, len(ret.Items))
	for _, item := range ret.Items {
		requested[item.TransactionItemID] += item.Quantity
	}

	for itemID, qty := range requested {
		limit, ok := limits[itemID]
		if !ok {
			return domain.NewSyncFieldError("items.transaction_item_id",
				"item retur tidak ada pada transaksi asal")
		}
		if qty > limit.Returnable {
			return domain.NewSyncFieldError("items.quantity", fmt.Sprintf(
				"kuantitas retur (%d) melebihi sisa yang boleh diretur (%d) untuk item %s",
				qty, limit.Returnable, itemID,
			))
		}
	}
	return nil
}

// deriveStateAfter menghitung `return_state` seolah retur ini sudah tersimpan.
func deriveStateAfter(snapshot *domain.ReturnSnapshot, ret *domain.Return) string {
	added := make(map[string]int, len(ret.Items))
	for _, item := range ret.Items {
		added[item.TransactionItemID] += item.Quantity
	}

	projected := &domain.ReturnSnapshot{Items: make([]*domain.ReturnableItem, 0, len(snapshot.Items))}
	for _, item := range snapshot.Items {
		extra := added[item.TransactionItemID]
		remaining := item.Returnable - extra
		if remaining < 0 {
			remaining = 0
		}
		projected.Items = append(projected.Items, &domain.ReturnableItem{
			TransactionItemID: item.TransactionItemID,
			ProductID:         item.ProductID,
			OriginalQuantity:  item.OriginalQuantity,
			AlreadyReturned:   item.AlreadyReturned + extra,
			Returnable:        remaining,
			UnitPrice:         item.UnitPrice,
		})
	}
	return projected.DeriveReturnState()
}

/* ── Pergerakan stok ──────────────────────────────────────────────────────── */

// applyStockMovement menerapkan aturan `restock` per baris — **inti butir 15**.
//
// ═══════════════════════════════════════════════════════════════════════════
// ARAH UANG DAN ARAH BARANG DAPAT BERBEDA
// ═══════════════════════════════════════════════════════════════════════════
//
// | `restock` | Uang            | Stok                    | `product_wastes` |
// |-----------|-----------------|-------------------------|------------------|
// | `true`    | kembali         | **kembali**             | tidak ditulis    |
// | `false`   | kembali         | **tetap terpotong**     | **ditulis**      |
//
// Itulah yang membuat retur mustahil direduksi menjadi "transaksi bernilai
// negatif": sebuah transaksi negatif akan selalu mengembalikan stok.
//
// ⚠️ Baris `product_wastes` yang lahir di sini **TIDAK memotong stok lagi**.
// Barangnya sudah terpotong saat penjualan dan memang tidak pernah kembali;
// memotongnya sekali lagi berarti menghitung barang yang sama dua kali, dan
// selisihnya baru muncul saat opname sebagai kehilangan yang tidak pernah
// terjadi. Ini perbedaan penting dari jalur waste biasa
// (`posSyncService.syncWastes`), yang memang harus memotong.
func (s *returnService) applyStockMovement(ctx context.Context, ret *domain.Return) error {
	for _, item := range ret.Items {
		if item.Quantity <= 0 {
			continue
		}

		if item.Restock {
			// `+1`: barang kembali ke rak, bahan bakunya kembali ke stok.
			if err := s.stock.applyToProduct(ctx, item.ProductID, item.Quantity, +1); err != nil {
				return err
			}
			continue
		}

		if err := s.recordWasteForReturn(ctx, ret, item); err != nil {
			return err
		}
	}
	return nil
}

// recordWasteForReturn menulis satu baris `product_wastes` untuk barang yang
// tidak kembali ke stok.
//
// `reason` diambil dari `waste_reason_code` bawaan baris retur. Validasi
// domain sudah memastikan kolom itu terisi untuk setiap item ber-`restock=false`
// ([11 §M13.3]); tanpanya, selisih stok muncul saat opname tanpa penjelasan —
// dan tertuduhnya adalah petugas gudang.
func (s *returnService) recordWasteForReturn(
	ctx context.Context,
	ret *domain.Return,
	item *domain.ReturnItem,
) error {
	reason := ""
	if item.WasteReasonCode != nil {
		reason = *item.WasteReasonCode
	}
	if reason == "" {
		// Pertahanan lapis kedua. Validasi domain seharusnya sudah menolaknya,
		// tetapi kolom `reason` di basis data bertipe NOT NULL dan galat
		// constraint mentah tidak memberi tahu siapa pun apa yang salah.
		return domain.NewSyncFieldError("items.waste_reason_code",
			"item yang tidak dikembalikan ke stok wajib menyertakan alasan pembuangan")
	}

	waste := &domain.ProductWaste{
		// UUID dibuat SERVER di sini, bukan klien: baris ini adalah turunan
		// yang dihasilkan server dan tidak pernah ada padanannya di perangkat,
		// sehingga tidak ada UUID klien yang dapat dipakai ulang.
		ID:         s.newID(),
		OutletID:   ret.OutletID,
		BusinessID: ret.BusinessID,
		StaffID:    ret.StaffID,
		ProductID:  item.ProductID,
		Quantity:   item.Quantity,
		Reason: fmt.Sprintf(
			"Retur %s — barang tidak dikembalikan ke stok (%s)",
			shortRef(ret.ID), reason,
		),
		ReasonCode: reason,
		ShiftID:    &ret.ShiftID,
		DeviceID:   ret.DeviceID,
		// Struk pembuangan TIDAK dicetak untuk baris turunan ini: struk retur
		// sudah terbit dan memuat item yang sama. Dua kertas untuk satu
		// peristiwa hanya menambah kebingungan saat rekonsiliasi.
		ReceiptPrinted: false,
		// Waktu perangkat diwarisi dari retur induknya agar keduanya berdekatan
		// di laporan; `created_at` tetap diisi server.
		ClientCreatedAt: ret.ClientCreatedAt,
	}
	return s.posRepo.SaveProductWaste(ctx, waste)
}

// shortRef memotong UUID menjadi delapan karakter untuk teks yang dibaca manusia.
func shortRef(id string) string {
	if len(id) <= 8 {
		return id
	}
	return id[:8]
}

/* ── Returnable ───────────────────────────────────────────────────────────── */

// Returnable melaporkan sisa yang masih boleh diretur per baris ([11 §4.5]).
//
// Dipakai perangkat yang menemukan transaksi lewat pencarian Kode Struk dan
// karenanya tidak memiliki riwayat returnya secara lokal. Menghitungnya di
// klien mustahil benar: retur dari perangkat lain tidak pernah terlihat sampai
// sinkronisasi berikutnya.
//
// **Membaca saja** — tetapi tetap di dalam transaksi basis data, karena
// `SnapshotForReturn` mengunci baris. Di luar transaksi, kunci itu dilepas
// seketika dan hasilnya sekadar boros tanpa jaminan tambahan.
func (s *returnService) Returnable(ctx context.Context, outletID, transactionID string) (*domain.ReturnableResponse, error) {
	var out *domain.ReturnableResponse

	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		original, err := s.posRepo.GetTransactionByID(txCtx, transactionID)
		if err != nil || original == nil {
			return domain.NewSyncFieldError("transaction_id", "transaksi tidak ditemukan")
		}

		// Isolasi antar-outlet ditegakkan di sini, bukan hanya di token: sebuah
		// UUID yang bocor tidak boleh cukup untuk membaca isi transaksi outlet
		// lain.
		if outletID != "" && original.OutletID != outletID {
			return domain.NewSyncFieldError("transaction_id", "transaksi tidak ditemukan")
		}

		snapshot, err := s.returnRepo.SnapshotForReturn(txCtx, transactionID)
		if err != nil {
			return err
		}

		out = &domain.ReturnableResponse{
			TransactionID: transactionID,
			ReturnState:   snapshot.DeriveReturnState(),
			Items:         snapshot.Items,
			Eligible:      true,
		}

		// Alasan ketidaklayakan dinyatakan APA ADANYA, bukan dengan
		// mengembalikan daftar kosong. Daftar kosong memaksa klien menebak, dan
		// tebakan yang salah menghasilkan pesan yang menyesatkan kasir.
		switch {
		case domain.IsCancellation(original.Status):
			out.Eligible = false
			out.Reason = "Transaksi sudah dibatalkan."
		case original.ReceiptPrintedAt == nil:
			out.Eligible = false
			out.Reason = "Struk belum pernah terbit; jalurnya adalah Pembatalan (Void), bukan Retur."
		case len(snapshot.Items) == 0:
			out.Eligible = false
			out.Reason = "Transaksi tidak memiliki item yang dapat diretur."
		case snapshot.IsFullyReturned():
			out.Eligible = false
			out.Reason = "Seluruh item pada transaksi ini sudah diretur."
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return out, nil
}

/* ── Pemetaan galat ───────────────────────────────────────────────────────── */

// ReturnErrorCode memetakan galat layanan retur ke kode kontrak ([11 §4.3]).
//
// Dipakai lapisan sync (untuk `errors[]`) maupun handler HTTP (untuk status
// code), sehingga keduanya tidak dapat menyimpang dalam menamai kegagalan yang
// sama.
func ReturnErrorCode(err error) string {
	var fieldErr *domain.SyncFieldError
	if !errors.As(err, &fieldErr) {
		return domain.ErrCodePersistFailed
	}

	switch fieldErr.Field {
	case "original_transaction_id", "transaction_id":
		return domain.ErrCodeOriginalNotFound
	case "items.quantity":
		return domain.ErrCodeReturnExceeds
	default:
		return domain.ErrCodeInvalidPayload
	}
}

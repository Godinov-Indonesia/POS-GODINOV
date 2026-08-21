package service

import (
	"context"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

// masterVersionBumper menaikkan versi master data outlet — butir 10 ([11 §4.4]).
//
// # Mengapa harus satu transaksi dengan mutasinya
//
// Gerbang Buka Shift memutuskan "master data perangkat ini mutakhir" dengan
// membandingkan dua angka. Bila versi dinaikkan SETELAH mutasi di-commit,
// terbuka jendela — sekecil apa pun — saat perangkat menarik daftar produk
// lama tetapi menerima nomor versi baru. Gerbang meloloskannya, dan kasir
// berjualan dengan harga kemarin sepanjang shift sementara sistem yakin ia
// sudah mutakhir. Selisihnya baru terlihat saat rekonsiliasi, ketika pelanggan
// sudah lama pulang.
//
// Menaikkannya SEBELUM mutasi sama buruknya dengan arah terbalik: mutasi yang
// gagal meninggalkan versi yang naik tanpa perubahan apa pun, dan setiap
// perangkat menarik ulang master data tanpa alasan.
type masterVersionBumper struct {
	txManager database.TransactionManager
	repo      domain.MasterVersionRepository
}

// run menjalankan mutasi lalu menaikkan versi outlet dalam satu transaksi.
//
// Bila dependensinya belum disuntikkan — server yang basis datanya belum
// dimigrasi — mutasi tetap berjalan apa adanya. Menolak mutasi master data
// hanya karena penghitung versi belum ada akan melumpuhkan dashboard pemilik
// demi fitur yang belum dipakai siapa pun.
func (b masterVersionBumper) run(ctx context.Context, outletID string, mutate func(ctx context.Context) error) error {
	if b.repo == nil || b.txManager == nil || outletID == "" {
		return mutate(ctx)
	}

	return b.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		if err := mutate(txCtx); err != nil {
			return err
		}
		_, err := b.repo.Bump(txCtx, outletID)
		return err
	})
}

// bump menaikkan versi tanpa mutasi pendamping.
//
// Dipakai jalur yang sudah berada di dalam transaksinya sendiri, sehingga
// membungkusnya lagi hanya akan menambah lapisan tanpa menambah jaminan.
func (b masterVersionBumper) bump(ctx context.Context, outletID string) error {
	if b.repo == nil || outletID == "" {
		return nil
	}
	_, err := b.repo.Bump(ctx, outletID)
	return err
}

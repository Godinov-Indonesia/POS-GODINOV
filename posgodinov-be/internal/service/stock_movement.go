package service

import (
	"context"

	"posgodinov-backend/internal/domain"
)

// bomStockAdjuster menggerakkan stok bahan baku lewat resep (BOM).
//
// ═══════════════════════════════════════════════════════════════════════════
// SATU TEMPAT, TIGA PEMANGGIL
// ═══════════════════════════════════════════════════════════════════════════
//
// Penjualan memotong stok, void mengembalikannya, retur mengembalikan sebagian.
// Ketiganya menempuh penelusuran BOM yang persis sama. Menyalinnya ke tiga
// tempat berarti perubahan berikutnya — mis. penanganan produk tanpa resep, atau
// pembulatan satuan — akan mengenai dua di antaranya dan meninggalkan satu yang
// diam-diam memakai aturan lama. Yang terlewat itu adalah tempat stok bocor.
//
// Seluruh metode di sini **mengandaikan pemanggilnya sudah membuka transaksi
// basis data**; `LockByID` menahan baris bahan baku sampai transaksi itu
// selesai. Dipanggil di luar transaksi, kuncinya dilepas begitu kueri selesai
// dan dua sinkronisasi bersamaan dapat saling menimpa.
type bomStockAdjuster struct {
	productRepo domain.ProductRepository
	rawMatRepo  domain.RawMaterialRepository
}

// applyToProduct menambah (`sign = +1`) atau mengurangi (`sign = -1`) stok
// bahan baku untuk sejumlah `quantity` unit produk.
//
// Produk yang sudah lenyap dari master data **dilewati, bukan digagalkan**:
// pemilik boleh menghapus produk kapan saja, dan penjualan yang sudah terjadi
// tidak boleh gagal tersinkron karena katalognya berubah setelahnya.
//
// Stok **boleh menjadi negatif**. Itu bukan kelalaian: memaksa stok berhenti di
// nol berarti menyembunyikan selisih yang justru harus dilihat pemilik pada
// opname berikutnya.
func (a bomStockAdjuster) applyToProduct(
	ctx context.Context,
	productID string,
	quantity int,
	sign float64,
) error {
	if quantity == 0 {
		return nil
	}

	product, err := a.productRepo.GetByID(ctx, productID)
	if err != nil {
		return nil // produk sudah tidak ada — lihat catatan di atas
	}

	for _, recipe := range product.Recipes {
		rm, err := a.rawMatRepo.LockByID(ctx, recipe.RawMaterialID)
		if err != nil {
			// Bahan baku yang hilang diperlakukan sama dengan produk yang
			// hilang: dilewati, bukan menggagalkan seluruh batch.
			continue
		}

		rm.Stock += sign * recipe.Quantity * float64(quantity)

		if err := a.rawMatRepo.Update(ctx, rm); err != nil {
			return err
		}
	}
	return nil
}

// deductTransaction memotong stok untuk seluruh item sebuah transaksi.
func (a bomStockAdjuster) deductTransaction(ctx context.Context, trx *domain.Transaction) error {
	return a.applyTransaction(ctx, trx, -1)
}

// restoreTransaction mengembalikan stok PENUH — dipakai jalur Void.
//
// Void menyatakan transaksi tidak pernah terjadi, sehingga seluruh bahan baku
// kembali. Berbeda dari Retur, yang mengembalikan hanya item ber-`restock`.
func (a bomStockAdjuster) restoreTransaction(ctx context.Context, trx *domain.Transaction) error {
	return a.applyTransaction(ctx, trx, +1)
}

func (a bomStockAdjuster) applyTransaction(
	ctx context.Context,
	trx *domain.Transaction,
	sign float64,
) error {
	for _, item := range trx.Items {
		if err := a.applyToProduct(ctx, item.ProductID, item.Quantity, sign); err != nil {
			return err
		}
	}
	return nil
}

// deductWaste memotong stok untuk satu laporan pembuangan.
//
// ⚠️ **Tidak dipakai jalur Retur.** Barang yang tidak kembali ke stok pada retur
// stoknya memang sudah terpotong saat penjualan; memotongnya lagi akan
// menghitung barang yang sama dua kali. Lihat `returnService.applyStockMovement`.
func (a bomStockAdjuster) deductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	return a.applyToProduct(ctx, waste.ProductID, waste.Quantity, -1)
}

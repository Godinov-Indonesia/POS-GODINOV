package unit

import (
	"context"
	"errors"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

// ════════════════════════════════════════════════════════════════════════════
// Versi master data — butir 10 ([11 §4.4], Fase M11.2)
//
// Gerbang Buka Shift memutuskan "master data perangkat ini mutakhir" hanya
// dengan membandingkan dua angka. Bila angka itu tidak pernah naik saat pemilik
// mengubah harga, gerbangnya meloloskan setiap perangkat dan butir 10 menjadi
// hiasan: kasir berjualan dengan harga kemarin sepanjang shift sementara sistem
// yakin ia sudah mutakhir.
// ════════════════════════════════════════════════════════════════════════════

type mockMasterVersionRepoUnit struct {
	version int64
	bumps   int
	failNow bool
}

func (m *mockMasterVersionRepoUnit) Get(ctx context.Context, outletID string) (int64, error) {
	return m.version, nil
}

func (m *mockMasterVersionRepoUnit) Bump(ctx context.Context, outletID string) (int64, error) {
	if m.failNow {
		return 0, errors.New("gagal menaikkan versi")
	}
	m.bumps++
	m.version++
	return m.version, nil
}

// failingCategoryRepo menolak setiap penulisan, untuk menguji bahwa versi TIDAK
// naik ketika mutasinya sendiri gagal.
type failingCategoryRepo struct{ MockProductCategoryRepository }

func (f *failingCategoryRepo) Create(ctx context.Context, c *domain.ProductCategory) error {
	return errors.New("gagal menulis")
}

func TestMasterVersionBumpedOnMasterDataMutation(t *testing.T) {
	ctx := context.Background()
	outletRepo := &MockOutletRepository{outlets: []*domain.Outlet{{ID: "o1", BusinessID: "b1"}}}

	t.Run("kategori baru menaikkan versi", func(t *testing.T) {
		versions := &mockMasterVersionRepoUnit{version: 10}
		svc := service.NewProductCategoryService(
			&MockProductCategoryRepository{}, outletRepo,
			service.WithCategoryMasterVersion(database.NewMockTransactionManager(), versions),
		)

		if _, err := svc.Create(ctx, "b1", "o1", &domain.CreateProductCategoryRequest{Name: "Minuman"}); err != nil {
			t.Fatalf("tidak diharapkan galat: %v", err)
		}

		if versions.bumps != 1 {
			t.Errorf("bump = %d, diharapkan 1", versions.bumps)
		}
		if versions.version != 11 {
			t.Errorf("versi = %d, diharapkan 11", versions.version)
		}
	})

	t.Run("mutasi yang gagal TIDAK menaikkan versi", func(t *testing.T) {
		// Versi yang naik tanpa perubahan apa pun membuat SETIAP perangkat
		// menarik ulang seluruh master data tanpa alasan — dan pada outlet
		// dengan koneksi buruk, penarikan itu memblokir Buka Shift.
		versions := &mockMasterVersionRepoUnit{version: 10}
		svc := service.NewProductCategoryService(
			&failingCategoryRepo{}, outletRepo,
			service.WithCategoryMasterVersion(database.NewMockTransactionManager(), versions),
		)

		if _, err := svc.Create(ctx, "b1", "o1", &domain.CreateProductCategoryRequest{Name: "Minuman"}); err == nil {
			t.Fatal("diharapkan galat dari repositori")
		}

		if versions.bumps != 0 {
			t.Errorf("bump = %d, diharapkan 0 — versi naik padahal mutasinya gagal", versions.bumps)
		}
	})

	t.Run("kegagalan menaikkan versi menggagalkan seluruh operasi", func(t *testing.T) {
		// Bila mutasi berhasil tetapi versi tidak naik, perangkat tidak akan
		// pernah tahu ada perubahan. Membiarkannya "berhasil sebagian" adalah
		// bentuk kegagalan paling senyap: tidak ada galat, dan datanya salah.
		versions := &mockMasterVersionRepoUnit{version: 10, failNow: true}
		svc := service.NewProductCategoryService(
			&MockProductCategoryRepository{}, outletRepo,
			service.WithCategoryMasterVersion(database.NewMockTransactionManager(), versions),
		)

		if _, err := svc.Create(ctx, "b1", "o1", &domain.CreateProductCategoryRequest{Name: "Minuman"}); err == nil {
			t.Fatal("diharapkan galat ketika kenaikan versi gagal")
		}
	})

	t.Run("tanpa suntikan repositori, mutasi tetap berjalan", func(t *testing.T) {
		// Server yang basis datanya belum dimigrasi tidak boleh kehilangan
		// kemampuan mengelola master data hanya karena penghitung versi belum
		// ada. Inilah yang membuat urutan rilis M18.2 mungkin.
		svc := service.NewProductCategoryService(&MockProductCategoryRepository{}, outletRepo)

		if _, err := svc.Create(ctx, "b1", "o1", &domain.CreateProductCategoryRequest{Name: "Minuman"}); err != nil {
			t.Fatalf("mutasi seharusnya tetap berjalan tanpa repositori versi: %v", err)
		}
	})
}

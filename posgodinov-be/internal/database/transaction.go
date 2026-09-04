package database

import (
	"context"

	"gorm.io/gorm"
)

type contextKey string

const (
	txKey contextKey = "gorm_transaction"
	TenantDBKey contextKey = "tenant_db"
)

// TransactionManager adalah kontrak untuk menjalankan fungsi di dalam scope transaksi
type TransactionManager interface {
	WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type postgresTransactionManager struct {
	db *gorm.DB
}

func NewTransactionManager(db *gorm.DB) TransactionManager {
	return &postgresTransactionManager{db: db}
}

// WithTransaction membungkus fungsi callback ke dalam sebuah DB transaction.
// Jika terjadi error pada `fn`, transaksi akan otomatis di-Rollback.
func (tm *postgresTransactionManager) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	// IKUT SERTA pada transaksi yang sudah berjalan, jangan membuka yang kedua.
	//
	// `tm.db` selalu koneksi ROOT, bukan handle transaksi dari context. Tanpa
	// penjaga ini, panggilan bersarang akan membuka transaksi KEDUA yang berdiri
	// sendiri: ia commit walau transaksi luar di-rollback, sehingga sebagian
	// perubahan bertahan dan sebagian lenyap. Kegagalan seperti itu tidak
	// memunculkan galat apa pun — ia hanya menyisakan data yang tidak konsisten.
	//
	// Ikut serta, bukan SavePoint: bila langkah dalam gagal, seluruh unit logis
	// memang harus batal. Galatnya merambat ke atas dan transaksi luar
	// menggulungnya.
	if _, ok := ctx.Value(txKey).(*gorm.DB); ok {
		return fn(ctx)
	}

	// First determine which DB to use (Tenant vs Default)
	dbToUse := GetDB(ctx, tm.db)

	return dbToUse.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Simpan object transaksi GORM ke dalam Context
		txCtx := context.WithValue(ctx, txKey, tx)
		return fn(txCtx)
	})
}

// GetDB adalah helper method untuk mengambil instance DB.
// Jika di dalam context terdapat transaksi aktif, maka ia akan mengembalikan DB Transaksi.
// Jika tidak ada transaksi, ia mengecek DB Tenant.
// Jika tidak ada, ia mengembalikan DB koneksi standard (Landlord).
func GetDB(ctx context.Context, defaultDB *gorm.DB) *gorm.DB {
	// 1. Transaction has highest priority
	if tx, ok := ctx.Value(txKey).(*gorm.DB); ok {
		return tx
	}
	
	// 2. Tenant DB has second priority
	if tenantDB, ok := ctx.Value(TenantDBKey).(*gorm.DB); ok && tenantDB != nil {
		return tenantDB
	}
	
	// 3. Fallback to default (Landlord) DB
	return defaultDB
}

// MockTransactionManager khusus digunakan di Unit / Feature Testing
type MockTransactionManager struct{}

func NewMockTransactionManager() TransactionManager {
	return &MockTransactionManager{}
}

func (m *MockTransactionManager) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	// Jalankan secara langsung tanpa inisiasi DB GORM di mock test
	return fn(ctx)
}

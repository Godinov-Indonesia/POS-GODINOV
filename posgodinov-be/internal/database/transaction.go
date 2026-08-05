package database

import (
	"context"

	"gorm.io/gorm"
)

type contextKey string

const (
	txKey contextKey = "gorm_transaction"
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
	return tm.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Simpan object transaksi GORM ke dalam Context
		txCtx := context.WithValue(ctx, txKey, tx)
		return fn(txCtx)
	})
}

// GetDB adalah helper method untuk mengambil instance DB.
// Jika di dalam context terdapat transaksi aktif, maka ia akan mengembalikan DB Transaksi.
// Jika tidak ada, ia mengembalikan DB koneksi standard.
func GetDB(ctx context.Context, defaultDB *gorm.DB) *gorm.DB {
	if tx, ok := ctx.Value(txKey).(*gorm.DB); ok {
		return tx
	}
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

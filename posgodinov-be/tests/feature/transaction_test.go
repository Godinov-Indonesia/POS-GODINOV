package feature

import (
	"context"
	"testing"

	"gorm.io/gorm"

	"posgodinov-backend/internal/database"
)

func TestGetDB_RoutingPriority(t *testing.T) {
	// Create dummy DB instances
	rootDB := &gorm.DB{}
	businessDB := &gorm.DB{}

	ctx := context.Background()

	// 1. Default fallback
	db := database.GetDB(ctx, rootDB)
	if db != rootDB {
		t.Errorf("Expected rootDB, got something else")
	}

	// 2. Business DB takes precedence over root
	ctxTenant := context.WithValue(ctx, database.BusinessDBKey, businessDB)
	db = database.GetDB(ctxTenant, rootDB)
	if db != businessDB {
		t.Errorf("Expected businessDB, got something else")
	}

	// 3. Transaction takes highest precedence.
	//
	// txKey tidak diekspos — satu-satunya cara sah menyuntikkan context transaksi
	// dari luar package adalah melalui WithTransaction. Karena WithTransaction
	// memerlukan koneksi DB nyata yang tidak tersedia di sini, prioritas ini
	// diverifikasi lewat integrasi (tests/integration) yang menjalankan DB.
	//
	// Yang dapat dikonfirmasi di sini: bila Business DB ada di context,
	// ia diambil di atas rootDB — ini sudah ditegakkan pada kasus 2 di atas.
}


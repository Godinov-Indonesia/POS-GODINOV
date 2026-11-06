package unit

import (
	"bytes"
	"compress/gzip"
	"context"
	"os"
	"path/filepath"
	"testing"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/service/storage"
)

func TestRestoreService_DryRunDiscovery(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "restore_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create mock backup directory structure
	landlordDir := filepath.Join(tmpDir, "posgodinov_landlord", "full")
	tenant1Dir := filepath.Join(tmpDir, "business_tenant_alpha", "full")
	tenant2Dir := filepath.Join(tmpDir, "business_tenant_beta", "full")

	_ = os.MkdirAll(landlordDir, 0755)
	_ = os.MkdirAll(tenant1Dir, 0755)
	_ = os.MkdirAll(tenant2Dir, 0755)

	// Create dummy .sql.gz files
	createDummyGzFile := func(dir, filename string) {
		f, _ := os.Create(filepath.Join(dir, filename))
		gz := gzip.NewWriter(f)
		_, _ = gz.Write([]byte("CREATE TABLE dummy (id int);"))
		_ = gz.Close()
		_ = f.Close()
	}

	createDummyGzFile(landlordDir, "full_posgodinov_landlord_2026-11-06_12-00-00.sql.gz")
	createDummyGzFile(tenant1Dir, "full_business_tenant_alpha_2026-11-06_12-00-00.sql.gz")
	createDummyGzFile(tenant2Dir, "full_business_tenant_beta_2026-11-06_12-00-00.sql.gz")

	cfg := &config.Config{
		DBName:        "posgodinov_landlord",
		RestoreSource: "local",
	}

	store := storage.NewLocalStorageProvider(tmpDir)
	restoreSvc := service.NewRestoreService(cfg, store, nil)

	ctx := context.Background()

	// 1. Test Dry-Run: should discover all 3 databases
	report, err := restoreSvc.RunRestore(ctx, service.RestoreOptions{
		Source: "local",
		DryRun: true,
	})
	if err != nil {
		t.Fatalf("dry run failed: %v", err)
	}

	if len(report.DatabasesRestored) != 3 {
		t.Errorf("expected 3 databases in dry run, got %d: %v", len(report.DatabasesRestored), report.DatabasesRestored)
	}

	// 2. Test Invalid Source error
	_, err = restoreSvc.RunRestore(ctx, service.RestoreOptions{
		Source: "invalid_cloud",
		DryRun: true,
	})
	if err == nil {
		t.Errorf("expected error on invalid source, got nil")
	}

	// 3. Test GDrive not configured error
	_, err = restoreSvc.RunRestore(ctx, service.RestoreOptions{
		Source: "gdrive",
		DryRun: true,
	})
	if err == nil {
		t.Errorf("expected error on unconfigured gdrive, got nil")
	}
}

func TestLocalStorageProvider_GetLatestDump(t *testing.T) {
	tmpDir := t.TempDir()
	store := storage.NewLocalStorageProvider(tmpDir)
	ctx := context.Background()

	dbName := "business_alpha"
	fullDir := filepath.Join(tmpDir, dbName, "full")
	_ = os.MkdirAll(fullDir, 0755)

	// Create 2 dumps with different timestamps
	fileOld := "full_business_alpha_2026-11-05_10-00-00.sql.gz"
	fileNew := "full_business_alpha_2026-11-06_18-00-00.sql.gz"

	writeGz := func(filename, content string) {
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		_, _ = gz.Write([]byte(content))
		_ = gz.Close()
		_, _ = store.Save(ctx, filepath.Join(dbName, "full", filename), &buf)
	}

	writeGz(fileOld, "OLD_CONTENT")
	writeGz(fileNew, "NEW_CONTENT")

	// Get latest dump should pick fileNew
	relPath, reader, err := store.GetLatestDump(ctx, dbName)
	if err != nil {
		t.Fatalf("failed to get latest dump: %v", err)
	}
	defer reader.Close()

	if !bytes.Contains([]byte(relPath), []byte(fileNew)) {
		t.Errorf("expected latest file %s, got %s", fileNew, relPath)
	}
}

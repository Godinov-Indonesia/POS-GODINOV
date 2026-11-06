package unit

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/service/storage"
)

type mockBackupRepo struct {
	jobs  map[string]*domain.BackupJob
	files map[string]*domain.BackupFile
}

func newMockBackupRepo() *mockBackupRepo {
	return &mockBackupRepo{
		jobs:  make(map[string]*domain.BackupJob),
		files: make(map[string]*domain.BackupFile),
	}
}

func (m *mockBackupRepo) CreateJob(ctx context.Context, job *domain.BackupJob) error {
	m.jobs[job.ID] = job
	return nil
}

func (m *mockBackupRepo) GetJobByID(ctx context.Context, id string) (*domain.BackupJob, error) {
	j, ok := m.jobs[id]
	if !ok {
		return nil, errors.New("job not found")
	}
	return j, nil
}

func (m *mockBackupRepo) ListJobs(ctx context.Context, limit, offset int) ([]*domain.BackupJob, int64, error) {
	var list []*domain.BackupJob
	for _, j := range m.jobs {
		list = append(list, j)
	}
	return list, int64(len(list)), nil
}

func (m *mockBackupRepo) UpdateJobProgress(ctx context.Context, id string, completedDBs int, totalSize int64, status domain.BackupStatus, errMsg *string, completedAt *time.Time) error {
	j, ok := m.jobs[id]
	if !ok {
		return errors.New("job not found")
	}
	j.CompletedDBs = completedDBs
	j.TotalSizeBytes = totalSize
	j.Status = status
	j.ErrorMessage = errMsg
	j.CompletedAt = completedAt
	return nil
}

func (m *mockBackupRepo) AddFile(ctx context.Context, file *domain.BackupFile) error {
	m.files[file.ID] = file
	return nil
}

func (m *mockBackupRepo) GetFileByID(ctx context.Context, id string) (*domain.BackupFile, error) {
	f, ok := m.files[id]
	if !ok {
		return nil, errors.New("file not found")
	}
	return f, nil
}

func (m *mockBackupRepo) ListFiles(ctx context.Context, filter domain.BackupFileFilter) ([]*domain.BackupFile, int64, error) {
	var list []*domain.BackupFile
	for _, f := range m.files {
		if filter.DBName != "" && f.DBName != filter.DBName {
			continue
		}
		if filter.Scope != "" && string(f.Scope) != filter.Scope {
			continue
		}
		list = append(list, f)
	}
	return list, int64(len(list)), nil
}

func (m *mockBackupRepo) DeleteFile(ctx context.Context, id string) error {
	delete(m.files, id)
	return nil
}

func TestLocalStorageProvider_SaveReadDelete(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "pos_backup_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	provider := storage.NewLocalStorageProvider(tmpDir)
	ctx := context.Background()

	relPath := "business_tenant_1/full/test_backup.sql.gz"
	sampleContent := []byte("GZIP_MOCK_CONTENT_ABC_123")

	// 1. Test Save
	res, err := provider.Save(ctx, relPath, bytes.NewReader(sampleContent))
	if err != nil {
		t.Fatalf("unexpected save error: %v", err)
	}
	expectedFullPath := filepath.Join(tmpDir, relPath)
	if res.RemoteID != expectedFullPath {
		t.Errorf("expected remote ID %s, got %s", expectedFullPath, res.RemoteID)
	}

	// Verify file on disk
	if _, err := os.Stat(expectedFullPath); os.IsNotExist(err) {
		t.Fatalf("file does not exist on disk at %s", expectedFullPath)
	}

	// 2. Test Read
	reader, err := provider.Read(ctx, relPath)
	if err != nil {
		t.Fatalf("unexpected read error: %v", err)
	}
	readBytes, err := io.ReadAll(reader)
	_ = reader.Close()
	if err != nil {
		t.Fatalf("failed to read from stream: %v", err)
	}
	if string(readBytes) != string(sampleContent) {
		t.Errorf("read content mismatch: expected %s, got %s", sampleContent, readBytes)
	}

	// 3. Test Delete
	if err := provider.Delete(ctx, relPath); err != nil {
		t.Fatalf("unexpected delete error: %v", err)
	}
	if _, err := os.Stat(expectedFullPath); !os.IsNotExist(err) {
		t.Errorf("file still exists after deletion")
	}
}

func TestBackupService_TriggerValidation(t *testing.T) {
	cfg := &config.Config{
		DBHost:   "localhost",
		DBPort:   "5432",
		DBName:   "posgodinov_landlord",
		DBUser:   "posgodinov",
		LogLevel: "error",
	}
	repo := newMockBackupRepo()
	store := storage.NewLocalStorageProvider(t.TempDir())
	svc := service.NewBackupService(cfg, repo, store, nil, nil)

	ctx := context.Background()

	// 1. Target TENANT without tenant_id should fail
	_, err := svc.TriggerBackup(ctx, "admin-1", &domain.TriggerBackupRequest{
		Target: domain.BackupTargetTenant,
	})
	if err == nil {
		t.Errorf("expected error when tenant_id is missing, got nil")
	}

	// 2. Target LANDLORD should succeed
	job, err := svc.TriggerBackup(ctx, "admin-1", &domain.TriggerBackupRequest{
		Target: domain.BackupTargetLandlord,
		Mode:   domain.BackupModeFull,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if job.ID == "" {
		t.Errorf("expected non-empty job ID")
	}
	if job.Status != domain.BackupStatusPending {
		t.Errorf("expected initial status PENDING, got %s", job.Status)
	}
	if job.TargetType != domain.BackupTargetLandlord {
		t.Errorf("expected target LANDLORD, got %s", job.TargetType)
	}

	// 3. Target ALL should succeed
	jobAll, err := svc.TriggerBackup(ctx, "admin-1", &domain.TriggerBackupRequest{
		Target: domain.BackupTargetAll,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if jobAll.TargetType != domain.BackupTargetAll {
		t.Errorf("expected target ALL, got %s", jobAll.TargetType)
	}
}

func TestBackupService_FilesAndJobsCRUD(t *testing.T) {
	cfg := &config.Config{
		DBName: "posgodinov_landlord",
	}
	repo := newMockBackupRepo()
	tmpDir := t.TempDir()
	store := storage.NewLocalStorageProvider(tmpDir)
	svc := service.NewBackupService(cfg, repo, store, nil, nil)
	ctx := context.Background()

	// Populate mock job
	sampleJob := &domain.BackupJob{
		ID:         "job-uuid-1",
		TargetType: domain.BackupTargetAll,
		Status:     domain.BackupStatusCompleted,
		CreatedAt:  time.Now(),
	}
	_ = repo.CreateJob(ctx, sampleJob)

	// Test GetJob
	j, err := svc.GetJob(ctx, "job-uuid-1")
	if err != nil {
		t.Fatalf("failed to get job: %v", err)
	}
	if j.ID != "job-uuid-1" {
		t.Errorf("expected job-uuid-1, got %s", j.ID)
	}

	// Test ListJobs
	jobs, total, err := svc.ListJobs(ctx, 1, 10)
	if err != nil {
		t.Fatalf("failed to list jobs: %v", err)
	}
	if total != 1 || len(jobs) != 1 {
		t.Errorf("expected 1 job, got %d (total %d)", len(jobs), total)
	}

	// Create a real file on disk for download test
	relPath := "posgodinov_landlord/full/full_posgodinov_landlord.sql.gz"
	_, _ = store.Save(ctx, relPath, bytes.NewReader([]byte("FAKE_GZIP_STREAM")))

	sampleFile := &domain.BackupFile{
		ID:            "file-uuid-1",
		JobID:         "job-uuid-1",
		DBName:        "posgodinov_landlord",
		Scope:         domain.BackupScopeFull,
		FilePath:      relPath,
		FileSizeBytes: 16,
		CreatedAt:     time.Now(),
	}
	_ = repo.AddFile(ctx, sampleFile)

	// Test ListFiles with filter
	files, totalFiles, err := svc.ListFiles(ctx, domain.BackupFileFilter{DBName: "posgodinov_landlord"})
	if err != nil {
		t.Fatalf("failed to list files: %v", err)
	}
	if totalFiles != 1 || len(files) != 1 {
		t.Errorf("expected 1 file, got %d", len(files))
	}

	// Test GetFileForDownload
	bf, reader, err := svc.GetFileForDownload(ctx, "file-uuid-1")
	if err != nil {
		t.Fatalf("failed to get file for download: %v", err)
	}
	content, _ := io.ReadAll(reader)
	_ = reader.Close()
	if string(content) != "FAKE_GZIP_STREAM" {
		t.Errorf("download content mismatch: %s", content)
	}
	if bf.ID != "file-uuid-1" {
		t.Errorf("expected file-uuid-1, got %s", bf.ID)
	}

	// Test DeleteFile
	if err := svc.DeleteFile(ctx, "file-uuid-1"); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}
	_, _, err = svc.GetFileForDownload(ctx, "file-uuid-1")
	if err == nil {
		t.Errorf("expected error after deletion, got nil")
	}
}

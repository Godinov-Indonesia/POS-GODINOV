package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/service/storage"
	"posgodinov-backend/pkg/token"
)

type mockFeatureBackupRepo struct {
	jobs  map[string]*domain.BackupJob
	files map[string]*domain.BackupFile
}

func newMockFeatureBackupRepo() *mockFeatureBackupRepo {
	return &mockFeatureBackupRepo{
		jobs:  make(map[string]*domain.BackupJob),
		files: make(map[string]*domain.BackupFile),
	}
}

func (m *mockFeatureBackupRepo) CreateJob(ctx context.Context, job *domain.BackupJob) error {
	m.jobs[job.ID] = job
	return nil
}

func (m *mockFeatureBackupRepo) GetJobByID(ctx context.Context, id string) (*domain.BackupJob, error) {
	j, ok := m.jobs[id]
	if !ok {
		return nil, errors.New("job not found")
	}
	return j, nil
}

func (m *mockFeatureBackupRepo) ListJobs(ctx context.Context, limit, offset int) ([]*domain.BackupJob, int64, error) {
	var list []*domain.BackupJob
	for _, j := range m.jobs {
		list = append(list, j)
	}
	return list, int64(len(list)), nil
}

func (m *mockFeatureBackupRepo) UpdateJobProgress(ctx context.Context, id string, completedDBs int, totalSize int64, status domain.BackupStatus, errMsg *string, completedAt *time.Time) error {
	j, ok := m.jobs[id]
	if ok {
		j.CompletedDBs = completedDBs
		j.TotalSizeBytes = totalSize
		j.Status = status
		j.ErrorMessage = errMsg
		j.CompletedAt = completedAt
	}
	return nil
}

func (m *mockFeatureBackupRepo) AddFile(ctx context.Context, file *domain.BackupFile) error {
	m.files[file.ID] = file
	return nil
}

func (m *mockFeatureBackupRepo) GetFileByID(ctx context.Context, id string) (*domain.BackupFile, error) {
	f, ok := m.files[id]
	if !ok {
		return nil, errors.New("file not found")
	}
	return f, nil
}

func (m *mockFeatureBackupRepo) ListFiles(ctx context.Context, filter domain.BackupFileFilter) ([]*domain.BackupFile, int64, error) {
	var list []*domain.BackupFile
	for _, f := range m.files {
		if filter.DBName != "" && f.DBName != filter.DBName {
			continue
		}
		list = append(list, f)
	}
	return list, int64(len(list)), nil
}

func (m *mockFeatureBackupRepo) DeleteFile(ctx context.Context, id string) error {
	delete(m.files, id)
	return nil
}

func setupBackupFeatureTest(t *testing.T) (*http.ServeMux, string, domain.BackupService, *storage.LocalStorageProvider, *mockFeatureBackupRepo) {
	tokenMaker, _ := token.NewPasetoMaker("12345678901234567890123456789012")
	adminToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "landlord-admin-1",
		Email: "admin@godinov.com",
		Type:  "landlord",
	}, 2*time.Hour)

	cfg := &config.Config{
		DBHost: "localhost",
		DBPort: "5432",
		DBName: "posgodinov_landlord",
		DBUser: "posgodinov",
	}

	repo := newMockFeatureBackupRepo()
	store := storage.NewLocalStorageProvider(t.TempDir())
	backupSvc := service.NewBackupService(cfg, repo, store, nil, nil)
	landlordHandler := handler.NewLandlordHandler(nil, backupSvc)

	mux := http.NewServeMux()
	landlordMw := func(h http.HandlerFunc) http.HandlerFunc {
		return middleware.LandlordAuthMiddleware(tokenMaker)(h)
	}

	mux.HandleFunc("POST /v1/landlord/backups/trigger", landlordMw(landlordHandler.TriggerBackup))
	mux.HandleFunc("GET /v1/landlord/backups/jobs", landlordMw(landlordHandler.ListBackupJobs))
	mux.HandleFunc("GET /v1/landlord/backups/jobs/{id}", landlordMw(landlordHandler.GetBackupJob))
	mux.HandleFunc("GET /v1/landlord/backups/files", landlordMw(landlordHandler.ListBackupFiles))
	mux.HandleFunc("GET /v1/landlord/backups/files/{id}/download", landlordMw(landlordHandler.DownloadBackupFile))
	mux.HandleFunc("DELETE /v1/landlord/backups/files/{id}", landlordMw(landlordHandler.DeleteBackupFile))

	return mux, adminToken, backupSvc, store, repo
}

func TestFeature_LandlordBackupEndpoints(t *testing.T) {
	mux, adminToken, _, store, repo := setupBackupFeatureTest(t)

	// 1. Trigger backup without token -> 401
	{
		req := httptest.NewRequest(http.MethodPost, "/v1/landlord/backups/trigger", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized without token, got %d", rr.Code)
		}
	}

	// 2. Trigger backup with Landlord token -> 202 Accepted
	var jobID string
	{
		body, _ := json.Marshal(domain.TriggerBackupRequest{
			Target: domain.BackupTargetLandlord,
			Mode:   domain.BackupModeFull,
		})
		req := httptest.NewRequest(http.MethodPost, "/v1/landlord/backups/trigger", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Code int              `json:"code"`
			Data domain.BackupJob `json:"data"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		jobID = resp.Data.ID
		if jobID == "" {
			t.Fatalf("expected non-empty job ID in response")
		}
	}

	// 3. List Backup Jobs -> 200 OK
	{
		req := httptest.NewRequest(http.MethodGet, "/v1/landlord/backups/jobs?page=1&limit=10", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rr.Code)
		}
	}

	// 4. Get Backup Job Details -> 200 OK
	{
		req := httptest.NewRequest(http.MethodGet, "/v1/landlord/backups/jobs/"+jobID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for job %s, got %d: %s", jobID, rr.Code, rr.Body.String())
		}
	}

	// 5. Seed a file and test List and Download
	relPath := "posgodinov_landlord/full/test_download.sql.gz"
	_, _ = store.Save(context.Background(), relPath, bytes.NewReader([]byte("MOCK_GZIP_BINARY")))
	testFileID := "file-feature-1"
	_ = repo.AddFile(context.Background(), &domain.BackupFile{
		ID:            testFileID,
		JobID:         jobID,
		DBName:        "posgodinov_landlord",
		Scope:         domain.BackupScopeFull,
		FilePath:      relPath,
		FileSizeBytes: 16,
		CreatedAt:     time.Now(),
	})

	// List Files -> 200 OK
	{
		req := httptest.NewRequest(http.MethodGet, "/v1/landlord/backups/files?db_name=posgodinov_landlord", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for listing files, got %d", rr.Code)
		}
	}

	// Download File -> 200 OK with binary stream
	{
		req := httptest.NewRequest(http.MethodGet, "/v1/landlord/backups/files/"+testFileID+"/download", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for download, got %d", rr.Code)
		}
		if rr.Header().Get("Content-Type") != "application/gzip" {
			t.Errorf("expected Content-Type application/gzip, got %s", rr.Header().Get("Content-Type"))
		}
		bodyBytes, _ := io.ReadAll(rr.Body)
		if string(bodyBytes) != "MOCK_GZIP_BINARY" {
			t.Errorf("downloaded content mismatch: %s", bodyBytes)
		}
	}

	// 6. Delete File -> 200 OK
	{
		req := httptest.NewRequest(http.MethodDelete, "/v1/landlord/backups/files/"+testFileID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for file deletion, got %d: %s", rr.Code, rr.Body.String())
		}
	}
}

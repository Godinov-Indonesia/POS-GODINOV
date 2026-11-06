package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type LocalStorageProvider struct {
	basePath string
}

func NewLocalStorageProvider(basePath string) *LocalStorageProvider {
	if basePath == "" {
		basePath = "./backups"
	}
	return &LocalStorageProvider{basePath: basePath}
}

func (l *LocalStorageProvider) Name() string {
	return "LOCAL"
}

func (l *LocalStorageProvider) GetFullPath(relativePath string) string {
	return filepath.Join(l.basePath, filepath.Clean(relativePath))
}

func (l *LocalStorageProvider) Save(ctx context.Context, relativePath string, r io.Reader) (*UploadResult, error) {
	fullPath := l.GetFullPath(relativePath)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	f, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file %s: %w", fullPath, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, r); err != nil {
		_ = os.Remove(fullPath)
		return nil, fmt.Errorf("failed to write file %s: %w", fullPath, err)
	}

	return &UploadResult{
		RemoteID:   fullPath,
		RemoteLink: "",
	}, nil
}

func (l *LocalStorageProvider) Read(ctx context.Context, relativePath string) (io.ReadCloser, error) {
	fullPath := l.GetFullPath(relativePath)
	f, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file %s: %w", fullPath, err)
	}
	return f, nil
}

func (l *LocalStorageProvider) Delete(ctx context.Context, relativePath string) error {
	fullPath := l.GetFullPath(relativePath)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file %s: %w", fullPath, err)
	}
	return nil
}

func (l *LocalStorageProvider) ListDBFolders(ctx context.Context) ([]string, error) {
	entries, err := os.ReadDir(l.basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read backup base directory: %w", err)
	}

	var dbs []string
	for _, entry := range entries {
		if entry.IsDir() {
			name := entry.Name()
			if !strings.HasPrefix(name, ".") {
				dbs = append(dbs, name)
			}
		}
	}
	sort.Strings(dbs)
	return dbs, nil
}

func (l *LocalStorageProvider) GetLatestDump(ctx context.Context, dbName string) (string, io.ReadCloser, error) {
	fullDir := filepath.Join(l.basePath, dbName, "full")
	entries, err := os.ReadDir(fullDir)
	if err != nil {
		return "", nil, fmt.Errorf("full backup directory not found for %s: %w", dbName, err)
	}

	var gzFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql.gz") {
			gzFiles = append(gzFiles, e.Name())
		}
	}

	if len(gzFiles) == 0 {
		return "", nil, fmt.Errorf("no .sql.gz backup files found in %s", fullDir)
	}

	// Sort descending so the latest timestamp comes first
	sort.Slice(gzFiles, func(i, j int) bool {
		return gzFiles[i] > gzFiles[j]
	})

	latestFile := gzFiles[0]
	fullPath := filepath.Join(fullDir, latestFile)
	f, err := os.Open(fullPath)
	if err != nil {
		return "", nil, fmt.Errorf("failed to open dump file %s: %w", fullPath, err)
	}

	relPath := filepath.Join(dbName, "full", latestFile)
	return relPath, f, nil
}

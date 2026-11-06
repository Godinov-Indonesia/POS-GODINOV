package storage

import (
	"context"
	"io"
)

type UploadResult struct {
	RemoteID   string
	RemoteLink string
}

type StorageProvider interface {
	Name() string
	Save(ctx context.Context, relativePath string, r io.Reader) (*UploadResult, error)
	Read(ctx context.Context, relativePath string) (io.ReadCloser, error)
	Delete(ctx context.Context, relativePath string) error
	ListDBFolders(ctx context.Context) ([]string, error)
	GetLatestDump(ctx context.Context, dbName string) (string, io.ReadCloser, error)
}

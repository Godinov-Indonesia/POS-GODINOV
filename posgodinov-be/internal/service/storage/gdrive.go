package storage

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"sync"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

type GoogleDriveStorageProvider struct {
	srv          *drive.Service
	rootFolderID string
	folderCache  map[string]string // "parentID/folderName" -> folderID
	mu           sync.RWMutex
}

func NewGoogleDriveStorageProvider(ctx context.Context, credentialsJSON string, rootFolderID string) (*GoogleDriveStorageProvider, error) {
	if credentialsJSON == "" {
		return nil, fmt.Errorf("google drive credentials JSON is empty")
	}

	srv, err := drive.NewService(ctx, option.WithCredentialsJSON([]byte(credentialsJSON)), option.WithScopes(drive.DriveFileScope))
	if err != nil {
		return nil, fmt.Errorf("failed to init google drive service: %w", err)
	}

	return &GoogleDriveStorageProvider{
		srv:          srv,
		rootFolderID: rootFolderID,
		folderCache:  make(map[string]string),
	}, nil
}

func (g *GoogleDriveStorageProvider) Name() string {
	return "GDRIVE"
}

func (g *GoogleDriveStorageProvider) getOrCreateFolder(ctx context.Context, parentID string, folderName string) (string, error) {
	cacheKey := fmt.Sprintf("%s/%s", parentID, folderName)

	g.mu.RLock()
	if id, ok := g.folderCache[cacheKey]; ok {
		g.mu.RUnlock()
		return id, nil
	}
	g.mu.RUnlock()

	g.mu.Lock()
	defer g.mu.Unlock()

	// Double-check after lock
	if id, ok := g.folderCache[cacheKey]; ok {
		return id, nil
	}

	escapedName := strings.ReplaceAll(folderName, "'", "\\'")
	query := fmt.Sprintf("name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", escapedName)
	if parentID != "" {
		query += fmt.Sprintf(" and '%s' in parents", parentID)
	}

	r, err := g.srv.Files.List().Q(query).Fields("files(id, name)").Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("failed to search folder %s: %w", folderName, err)
	}

	if len(r.Files) > 0 {
		folderID := r.Files[0].Id
		g.folderCache[cacheKey] = folderID
		return folderID, nil
	}

	// Create new folder
	newFolder := &drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
	}
	if parentID != "" {
		newFolder.Parents = []string{parentID}
	}

	created, err := g.srv.Files.Create(newFolder).Fields("id").Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("failed to create folder %s: %w", folderName, err)
	}

	g.folderCache[cacheKey] = created.Id
	return created.Id, nil
}

func (g *GoogleDriveStorageProvider) resolveFolderHierarchy(ctx context.Context, relativePath string) (string, string, error) {
	cleanPath := filepath.ToSlash(filepath.Clean(relativePath))
	dir := filepath.Dir(cleanPath)
	filename := filepath.Base(cleanPath)

	currentParentID := g.rootFolderID
	if dir == "." || dir == "/" || dir == "" {
		return currentParentID, filename, nil
	}

	parts := strings.Split(dir, "/")
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		folderID, err := g.getOrCreateFolder(ctx, currentParentID, part)
		if err != nil {
			return "", "", err
		}
		currentParentID = folderID
	}

	return currentParentID, filename, nil
}

func (g *GoogleDriveStorageProvider) Save(ctx context.Context, relativePath string, r io.Reader) (*UploadResult, error) {
	parentID, filename, err := g.resolveFolderHierarchy(ctx, relativePath)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve drive folders: %w", err)
	}

	f := &drive.File{
		Name: filename,
	}
	if parentID != "" {
		f.Parents = []string{parentID}
	}

	created, err := g.srv.Files.Create(f).Media(r).Fields("id, webViewLink").Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to drive: %w", err)
	}

	return &UploadResult{
		RemoteID:   created.Id,
		RemoteLink: created.WebViewLink,
	}, nil
}

func (g *GoogleDriveStorageProvider) Read(ctx context.Context, remoteID string) (io.ReadCloser, error) {
	resp, err := g.srv.Files.Get(remoteID).Download()
	if err != nil {
		return nil, fmt.Errorf("failed to download from drive: %w", err)
	}
	return resp.Body, nil
}

func (g *GoogleDriveStorageProvider) Delete(ctx context.Context, remoteID string) error {
	if err := g.srv.Files.Delete(remoteID).Context(ctx).Do(); err != nil {
		return fmt.Errorf("failed to delete from drive: %w", err)
	}
	return nil
}

func (g *GoogleDriveStorageProvider) ListDBFolders(ctx context.Context) ([]string, error) {
	query := "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
	if g.rootFolderID != "" {
		query += fmt.Sprintf(" and '%s' in parents", g.rootFolderID)
	}

	r, err := g.srv.Files.List().Q(query).Fields("files(id, name)").Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to list drive folders: %w", err)
	}

	var dbs []string
	for _, f := range r.Files {
		dbs = append(dbs, f.Name)
	}
	return dbs, nil
}

func (g *GoogleDriveStorageProvider) GetLatestDump(ctx context.Context, dbName string) (string, io.ReadCloser, error) {
	dbFolderID, err := g.getOrCreateFolder(ctx, g.rootFolderID, dbName)
	if err != nil {
		return "", nil, err
	}

	fullFolderID, err := g.getOrCreateFolder(ctx, dbFolderID, "full")
	if err != nil {
		return "", nil, err
	}

	query := fmt.Sprintf("'%s' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false", fullFolderID)
	r, err := g.srv.Files.List().Q(query).OrderBy("createdTime desc").Fields("files(id, name)").PageSize(1).Context(ctx).Do()
	if err != nil {
		return "", nil, fmt.Errorf("failed to list dump files in drive: %w", err)
	}

	if len(r.Files) == 0 {
		return "", nil, fmt.Errorf("no backup files found in drive for db %s", dbName)
	}

	topFile := r.Files[0]
	resp, err := g.srv.Files.Get(topFile.Id).Download()
	if err != nil {
		return "", nil, fmt.Errorf("failed to download top dump file %s from drive: %w", topFile.Name, err)
	}

	return topFile.Name, resp.Body, nil
}

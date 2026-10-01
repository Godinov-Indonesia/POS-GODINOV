package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/service"
)

func TestUploadService_GenerateProductImageSignature_NotConfigured(t *testing.T) {
	cfg := &config.Config{}
	svc := service.NewUploadService(cfg)

	_, err := svc.GenerateProductImageSignature(context.Background())
	if err == nil {
		t.Fatal("expected error when Cloudinary credentials are not set, got nil")
	}
	if !errors.Is(err, service.ErrCloudinaryNotConfigured) {
		t.Fatalf("expected ErrCloudinaryNotConfigured, got %v", err)
	}
}

func TestUploadService_GenerateProductImageSignature_Success(t *testing.T) {
	cfg := &config.Config{
		CloudinaryCloudName: "test-cloud",
		CloudinaryAPIKey:    "test-key",
		CloudinaryAPISecret: "test-secret",
		CloudinaryFolder:    "posgodinov/test",
	}
	svc := service.NewUploadService(cfg)

	resp, err := svc.GenerateProductImageSignature(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.CloudName != "test-cloud" {
		t.Errorf("expected cloud_name 'test-cloud', got '%s'", resp.CloudName)
	}
	if resp.APIKey != "test-key" {
		t.Errorf("expected api_key 'test-key', got '%s'", resp.APIKey)
	}
	if resp.Folder != "posgodinov/test" {
		t.Errorf("expected folder 'posgodinov/test', got '%s'", resp.Folder)
	}
	if resp.Signature == "" {
		t.Error("expected non-empty signature")
	}
	if resp.Timestamp <= 0 || resp.Timestamp > time.Now().Add(5*time.Second).Unix() {
		t.Errorf("invalid timestamp: %d", resp.Timestamp)
	}
}

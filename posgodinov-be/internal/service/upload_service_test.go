package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

func TestUploadService_GenerateUploadSignature_NotConfigured(t *testing.T) {
	cfg := &config.Config{}
	svc := service.NewUploadService(cfg)

	_, err := svc.GenerateUploadSignature(context.Background(), "biz-123", domain.UploadPurposeProduct)
	if err == nil {
		t.Fatal("expected error when Cloudinary credentials are not set, got nil")
	}
	if !errors.Is(err, service.ErrCloudinaryNotConfigured) {
		t.Fatalf("expected ErrCloudinaryNotConfigured, got %v", err)
	}
}

func TestUploadService_GenerateUploadSignature_Success(t *testing.T) {
	cfg := &config.Config{
		CloudinaryCloudName: "test-cloud",
		CloudinaryAPIKey:    "test-key",
		CloudinaryAPISecret: "test-secret",
		CloudinaryFolder:    "posgodinov",
	}
	svc := service.NewUploadService(cfg)

	// Test product purpose
	resp, err := svc.GenerateUploadSignature(context.Background(), "biz-99", domain.UploadPurposeProduct)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.CloudName != "test-cloud" {
		t.Errorf("expected cloud_name 'test-cloud', got '%s'", resp.CloudName)
	}
	if resp.APIKey != "test-key" {
		t.Errorf("expected api_key 'test-key', got '%s'", resp.APIKey)
	}
	expectedFolder := "posgodinov/biz-99/products"
	if resp.Folder != expectedFolder {
		t.Errorf("expected folder '%s', got '%s'", expectedFolder, resp.Folder)
	}
	if resp.Signature == "" {
		t.Error("expected non-empty signature")
	}
	if resp.Timestamp <= 0 || resp.Timestamp > time.Now().Add(5*time.Second).Unix() {
		t.Errorf("invalid timestamp: %d", resp.Timestamp)
	}

	// Test profile purpose
	respProfile, err := svc.GenerateUploadSignature(context.Background(), "biz-99", domain.UploadPurposeProfile)
	if err != nil {
		t.Fatalf("unexpected error for profile: %v", err)
	}
	expectedProfileFolder := "posgodinov/biz-99/profiles"
	if respProfile.Folder != expectedProfileFolder {
		t.Errorf("expected folder '%s', got '%s'", expectedProfileFolder, respProfile.Folder)
	}
}

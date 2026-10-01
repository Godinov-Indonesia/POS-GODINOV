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

	_, err := svc.GenerateUploadSignature(context.Background(), "biz-123", &domain.CreateUploadSignatureRequest{
		Purpose: domain.UploadPurposeProduct,
	})
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

	// 1. Test product purpose with outlet_id: CLOUDINARY_FOLDER/business_id/outlet_id/products
	resp, err := svc.GenerateUploadSignature(context.Background(), "biz-99", &domain.CreateUploadSignatureRequest{
		Purpose:  domain.UploadPurposeProduct,
		OutletID: "out-456",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.CloudName != "test-cloud" {
		t.Errorf("expected cloud_name 'test-cloud', got '%s'", resp.CloudName)
	}
	if resp.APIKey != "test-key" {
		t.Errorf("expected api_key 'test-key', got '%s'", resp.APIKey)
	}
	expectedProductFolder := "posgodinov/biz-99/out-456/products"
	if resp.Folder != expectedProductFolder {
		t.Errorf("expected folder '%s', got '%s'", expectedProductFolder, resp.Folder)
	}
	if resp.Signature == "" {
		t.Error("expected non-empty signature")
	}
	if resp.Timestamp <= 0 || resp.Timestamp > time.Now().Add(5*time.Second).Unix() {
		t.Errorf("invalid timestamp: %d", resp.Timestamp)
	}

	// 2. Test profile purpose: CLOUDINARY_FOLDER/business_id/profiles
	respProfile, err := svc.GenerateUploadSignature(context.Background(), "biz-99", &domain.CreateUploadSignatureRequest{
		Purpose: domain.UploadPurposeProfile,
	})
	if err != nil {
		t.Fatalf("unexpected error for profile: %v", err)
	}
	expectedProfileFolder := "posgodinov/biz-99/profiles"
	if respProfile.Folder != expectedProfileFolder {
		t.Errorf("expected folder '%s', got '%s'", expectedProfileFolder, respProfile.Folder)
	}
}

package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2/api"
	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/domain"
)

var (
	ErrCloudinaryNotConfigured = errors.New("layanan upload Cloudinary belum dikonfigurasi di server")
)

type uploadService struct {
	cfg *config.Config
	now func() time.Time
}

func NewUploadService(cfg *config.Config) domain.UploadService {
	return &uploadService{
		cfg: cfg,
		now: time.Now,
	}
}

// GenerateUploadSignature menghasilkan signature dengan folder dinamis multi-tenant:
// Format folder: {root_folder}/{business_id}/{purpose} (mis. posgodinov/biz-123/products)
func (s *uploadService) GenerateUploadSignature(
	ctx context.Context,
	businessID string,
	purpose domain.UploadPurpose,
) (*domain.UploadSignatureResponse, error) {
	if s.cfg.CloudinaryCloudName == "" || s.cfg.CloudinaryAPIKey == "" || s.cfg.CloudinaryAPISecret == "" {
		return nil, ErrCloudinaryNotConfigured
	}

	ts := s.now().Unix()

	rootFolder := strings.Trim(s.cfg.CloudinaryFolder, "/")
	if rootFolder == "" {
		rootFolder = "posgodinov"
	}

	sanitizedPurpose := strings.ToLower(strings.TrimSpace(string(purpose)))
	if sanitizedPurpose == "" {
		sanitizedPurpose = string(domain.UploadPurposeProduct)
	}

	sanitizedBizID := strings.TrimSpace(businessID)
	if sanitizedBizID == "" {
		sanitizedBizID = "general"
	}

	// Folder dinamis multi-tenant
	folder := fmt.Sprintf("%s/%s/%s", rootFolder, sanitizedBizID, sanitizedPurpose)

	params := url.Values{}
	params.Set("timestamp", strconv.FormatInt(ts, 10))
	params.Set("folder", folder)

	sig, err := api.SignParameters(params, s.cfg.CloudinaryAPISecret)
	if err != nil {
		return nil, errors.New("gagal membuat signature upload: " + err.Error())
	}

	return &domain.UploadSignatureResponse{
		Signature: sig,
		Timestamp: ts,
		APIKey:    s.cfg.CloudinaryAPIKey,
		CloudName: s.cfg.CloudinaryCloudName,
		Folder:    folder,
	}, nil
}

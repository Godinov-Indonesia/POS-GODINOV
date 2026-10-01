package service

import (
	"context"
	"errors"
	"net/url"
	"strconv"
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

func (s *uploadService) GenerateProductImageSignature(ctx context.Context) (*domain.UploadSignatureResponse, error) {
	if s.cfg.CloudinaryCloudName == "" || s.cfg.CloudinaryAPIKey == "" || s.cfg.CloudinaryAPISecret == "" {
		return nil, ErrCloudinaryNotConfigured
	}

	ts := s.now().Unix()
	folder := s.cfg.CloudinaryFolder

	params := url.Values{}
	params.Set("timestamp", strconv.FormatInt(ts, 10))
	if folder != "" {
		params.Set("folder", folder)
	}

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

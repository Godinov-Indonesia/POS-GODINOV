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
// - Produk dengan outlet_id: {env}/{business_id}/{outlet_id}/products
// - Produk tanpa outlet_id: {env}/{business_id}/products
// - Profil bisnis / target lain: {env}/{business_id}/{purpose}
func (s *uploadService) GenerateUploadSignature(
	ctx context.Context,
	businessID string,
	req *domain.CreateUploadSignatureRequest,
) (*domain.UploadSignatureResponse, error) {
	if s.cfg.CloudinaryCloudName == "" || s.cfg.CloudinaryAPIKey == "" || s.cfg.CloudinaryAPISecret == "" {
		return nil, ErrCloudinaryNotConfigured
	}

	ts := s.now().Unix()

	rootFolder := strings.Trim(s.cfg.CloudinaryFolder, "/")
	if rootFolder == "" {
		rootFolder = "posgodinov"
	}

	sanitizedBizID := strings.TrimSpace(businessID)
	if sanitizedBizID == "" {
		sanitizedBizID = "general"
	}

	purpose := domain.UploadPurposeProduct
	outletID := ""
	if req != nil {
		if req.Purpose != "" {
			purpose = req.Purpose
		}
		outletID = strings.TrimSpace(req.OutletID)
	}

	sanitizedPurpose := strings.ToLower(strings.TrimSpace(string(purpose)))
	if sanitizedPurpose == "" {
		sanitizedPurpose = string(domain.UploadPurposeProduct)
	}

	var folder string
	if sanitizedPurpose == string(domain.UploadPurposeProduct) && outletID != "" {
		folder = fmt.Sprintf("%s/%s/%s/products", rootFolder, sanitizedBizID, outletID)
	} else if outletID != "" {
		folder = fmt.Sprintf("%s/%s/%s/%s", rootFolder, sanitizedBizID, outletID, sanitizedPurpose)
	} else {
		folder = fmt.Sprintf("%s/%s/%s", rootFolder, sanitizedBizID, sanitizedPurpose)
	}

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

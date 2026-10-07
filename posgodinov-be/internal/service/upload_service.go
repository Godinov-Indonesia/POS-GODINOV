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

type UploadServiceOption func(*uploadService)

func WithUploadPolicyEngine(pe domain.PolicyEngine) UploadServiceOption {
	return func(s *uploadService) {
		s.policyEngine = pe
	}
}

func WithUploadStorageUsage(fn func(ctx context.Context, businessID string) (int64, error)) UploadServiceOption {
	return func(s *uploadService) {
		s.getStorageUsage = fn
	}
}

type uploadService struct {
	cfg             *config.Config
	now             func() time.Time
	policyEngine    domain.PolicyEngine
	getStorageUsage func(ctx context.Context, businessID string) (int64, error)
}

func NewUploadService(cfg *config.Config, opts ...UploadServiceOption) domain.UploadService {
	s := &uploadService{
		cfg: cfg,
		now: time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
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
	if s.policyEngine != nil && businessID != "" && businessID != "general" {
		limit, err := s.policyEngine.GetNumericLimit(ctx, businessID, "cloud_storage_mb")
		if err != nil {
			return nil, err
		}
		var usage int64 = 0
		if s.getStorageUsage != nil {
			u, err := s.getStorageUsage(ctx, businessID)
			if err != nil {
				return nil, err
			}
			usage = u
		}
		if limit != -1 && usage >= limit {
			return nil, &QuotaExceededError{
				FeatureKey:   "cloud_storage_mb",
				CurrentUsage: usage,
				LimitValue:   limit,
			}
		}
	}

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

package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

type posMobileCredentialService struct {
	repo         domain.POSMobileCredentialRepository
	landlordRepo domain.LandlordRepository
}

func NewPOSMobileCredentialService(
	repo domain.POSMobileCredentialRepository,
	landlordRepo ...domain.LandlordRepository,
) domain.POSMobileCredentialService {
	s := &posMobileCredentialService{repo: repo}
	if len(landlordRepo) > 0 {
		s.landlordRepo = landlordRepo[0]
	}
	return s
}

func generateRandomCredentialCode() string {
	return fmt.Sprintf("POS-%s-%s-%s",
		utils.GenerateRandomString(4),
		utils.GenerateRandomString(4),
		utils.GenerateRandomString(4),
	)
}

func (s *posMobileCredentialService) Create(
	ctx context.Context,
	adminID string,
	req *domain.CreatePOSMobileCredentialRequest,
) (*domain.POSMobileCredential, error) {
	if req == nil || strings.TrimSpace(req.Label) == "" {
		return nil, errors.New("label kredensial tidak boleh kosong")
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		// Generate random code until unique
		for i := 0; i < 5; i++ {
			candidate := generateRandomCredentialCode()
			if _, err := s.repo.GetByCode(ctx, candidate); err != nil {
				code = candidate
				break
			}
		}
		if code == "" {
			return nil, errors.New("gagal menghasilkan kode kredensial acak, silakan coba lagi")
		}
	} else {
		if len(code) < 6 {
			return nil, errors.New("kode kredensial minimal 6 karakter")
		}
		if existing, _ := s.repo.GetByCode(ctx, code); existing != nil {
			return nil, errors.New("kode kredensial pos mobile sudah digunakan")
		}
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	now := time.Now()
	cred := &domain.POSMobileCredential{
		ID:         utils.NewUUID(),
		Code:       code,
		Label:      strings.TrimSpace(req.Label),
		Notes:      strings.TrimSpace(req.Notes),
		BusinessID: req.BusinessID,
		IsActive:   isActive,
		UsageCount: 0,
		MaxUsage:   req.MaxUsage,
		ExpiresAt:  req.ExpiresAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if adminID != "" {
		cred.CreatedBy = &adminID
	}

	if err := s.repo.Create(ctx, cred); err != nil {
		return nil, fmt.Errorf("gagal membuat kredensial pos mobile: %w", err)
	}

	if s.landlordRepo != nil && adminID != "" {
		meta, _ := json.Marshal(map[string]any{
			"code":  cred.Code,
			"label": cred.Label,
		})
		_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
			ID:         utils.NewUUID(),
			UserID:     adminID,
			Action:     "CREATE_POS_CREDENTIAL",
			TargetType: "POS_CREDENTIAL",
			TargetID:   cred.ID,
			Metadata:   domain.JSONB(meta),
			CreatedAt:  time.Now(),
		})
	}

	return cred, nil
}

func (s *posMobileCredentialService) GetByID(ctx context.Context, id string) (*domain.POSMobileCredential, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *posMobileCredentialService) List(
	ctx context.Context,
	search string,
	isActive *bool,
	page, limit int,
) ([]domain.POSMobileCredential, int64, error) {
	return s.repo.List(ctx, search, isActive, page, limit)
}

func (s *posMobileCredentialService) Update(
	ctx context.Context,
	adminID, id string,
	req *domain.UpdatePOSMobileCredentialRequest,
) (*domain.POSMobileCredential, error) {
	cred, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Label != nil {
		trimmed := strings.TrimSpace(*req.Label)
		if trimmed == "" {
			return nil, errors.New("label kredensial tidak boleh kosong")
		}
		cred.Label = trimmed
	}
	if req.Notes != nil {
		cred.Notes = strings.TrimSpace(*req.Notes)
	}
	if req.BusinessID != nil {
		cred.BusinessID = req.BusinessID
	}
	if req.IsActive != nil {
		cred.IsActive = *req.IsActive
	}
	if req.MaxUsage != nil {
		cred.MaxUsage = *req.MaxUsage
	}
	if req.ExpiresAt != nil {
		cred.ExpiresAt = req.ExpiresAt
	}

	if err := s.repo.Update(ctx, cred); err != nil {
		return nil, fmt.Errorf("gagal memperbarui kredensial pos mobile: %w", err)
	}

	if s.landlordRepo != nil && adminID != "" {
		meta, _ := json.Marshal(map[string]any{
			"code":      cred.Code,
			"label":     cred.Label,
			"is_active": cred.IsActive,
		})
		_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
			ID:         utils.NewUUID(),
			UserID:     adminID,
			Action:     "UPDATE_POS_CREDENTIAL",
			TargetType: "POS_CREDENTIAL",
			TargetID:   cred.ID,
			Metadata:   domain.JSONB(meta),
			CreatedAt:  time.Now(),
		})
	}

	return cred, nil
}

func (s *posMobileCredentialService) Delete(ctx context.Context, adminID, id string) error {
	cred, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("gagal menghapus kredensial pos mobile: %w", err)
	}

	if s.landlordRepo != nil && adminID != "" {
		meta, _ := json.Marshal(map[string]any{
			"code":  cred.Code,
			"label": cred.Label,
		})
		_ = s.landlordRepo.CreateAuditLog(ctx, &domain.LandlordAuditLog{
			ID:         utils.NewUUID(),
			UserID:     adminID,
			Action:     "DELETE_POS_CREDENTIAL",
			TargetType: "POS_CREDENTIAL",
			TargetID:   id,
			Metadata:   domain.JSONB(meta),
			CreatedAt:  time.Now(),
		})
	}

	return nil
}

func (s *posMobileCredentialService) Verify(
	ctx context.Context,
	code string,
) (*domain.VerifyPOSMobileCredentialResponse, error) {
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	if cleanCode == "" {
		return nil, errors.New("kode verifikasi tidak boleh kosong")
	}

	cred, err := s.repo.GetByCode(ctx, cleanCode)
	if err != nil {
		return nil, errors.New("kode verifikasi kredensial pos mobile tidak valid atau tidak ditemukan")
	}

	if !cred.IsActive {
		return nil, errors.New("kredensial pos mobile telah dinonaktifkan")
	}

	now := time.Now()
	if cred.ExpiresAt != nil && cred.ExpiresAt.Before(now) {
		return nil, errors.New("kredensial pos mobile telah kadaluarsa")
	}

	if cred.MaxUsage > 0 && cred.UsageCount >= cred.MaxUsage {
		return nil, errors.New("batas penggunaan kredensial pos mobile telah habis")
	}

	_ = s.repo.IncrementUsage(ctx, cred.ID)
	cred.UsageCount++
	cred.LastUsedAt = &now

	return &domain.VerifyPOSMobileCredentialResponse{
		Valid:        true,
		Message:      "Kredensial POS mobile berhasil diverifikasi",
		CredentialID: cred.ID,
		Label:        cred.Label,
		BusinessID:   cred.BusinessID,
		Credential:   cred,
	}, nil
}

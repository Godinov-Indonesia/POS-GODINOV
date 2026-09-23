package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
	"posgodinov-backend/pkg/utils"
)

type businessService struct {
	repo          domain.BusinessRepository
	tokenMaker    token.TokenMaker
	txManager     database.TransactionManager
	tenantManager *database.BusinessDBManager
}

func NewBusinessService(repo domain.BusinessRepository, tokenMaker token.TokenMaker, txManager database.TransactionManager, tenantManager *database.BusinessDBManager) domain.BusinessService {
	return &businessService{
		repo:          repo,
		tokenMaker:    tokenMaker,
		txManager:     txManager,
		tenantManager: tenantManager,
	}
}

func (s *businessService) Register(ctx context.Context, req *domain.RegisterBusinessRequest) (*domain.RegisterBusinessResponse, error) {
	if req.Password != req.ConfirmationPassword {
		return nil, errors.New("password dan konfirmasi password tidak cocok")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("gagal mengenkripsi password")
	}

	id := utils.GenerateRandomString(8)

	// Format: 3 char Name + 2 char OwnerName + ddMMyy
	namePrefix := "XXX"
	if len(req.Name) >= 3 {
		namePrefix = strings.ToUpper(req.Name[:3])
	} else if len(req.Name) > 0 {
		namePrefix = strings.ToUpper(req.Name)
	}

	ownerPrefix := "XX"
	if len(req.OwnerName) >= 2 {
		ownerPrefix = strings.ToUpper(req.OwnerName[:2])
	} else if len(req.OwnerName) > 0 {
		ownerPrefix = strings.ToUpper(req.OwnerName)
	}
	
	dateStr := time.Now().Format("020106")
	serialBusiness := fmt.Sprintf("%s%s%s", namePrefix, ownerPrefix, dateStr)

	business := &domain.Business{
		ID:             id,
		SerialBusiness: serialBusiness,
		Email:          req.Email,
		Password:       string(hashedPassword),
		Name:           req.Name,
		OwnerName:      req.OwnerName,
	}

	// Gunakan DB Transaction (Best Practice dengan TransactionManager)
	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Insert data bisnis menggunakan txCtx agar terbaca oleh GORM sebagai transaksi aktif
		if err := s.repo.Create(txCtx, business); err != nil {
			return err
		}
		
		// TODO: Nantinya di dalam transaksi ini, kita juga bisa otomatis 
		// membuatkan data Outlet Pusat (Default Outlet) atau Default Role
		
		// Setup database untuk tenant baru
		if s.tenantManager != nil {
			if err := s.tenantManager.CreateNewTenantDatabase(business.ID); err != nil {
				return fmt.Errorf("gagal membuat database tenant: %w", err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Generate Access Token (24 Jam)
	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "access",
	}, 24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat access token")
	}

	// Generate Refresh Token (7 Hari)
	refreshToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "refresh",
	}, 7*24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat refresh token")
	}

	return &domain.RegisterBusinessResponse{
		Business:     business,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *businessService) Login(ctx context.Context, req *domain.LoginBusinessRequest) (*domain.LoginBusinessResponse, error) {
	business, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		// Either record not found or DB error, returning generic message for security
		return nil, errors.New("email atau password salah")
	}

	err = bcrypt.CompareHashAndPassword([]byte(business.Password), []byte(req.Password))
	if err != nil {
		return nil, errors.New("email atau password salah")
	}

	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "access",
	}, 24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat access token")
	}

	refreshToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "refresh",
	}, 7*24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat refresh token")
	}

	return &domain.LoginBusinessResponse{
		Business:     business,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *businessService) RefreshToken(ctx context.Context, req *domain.RefreshTokenRequest) (*domain.RefreshTokenResponse, error) {
	payload, err := s.tokenMaker.VerifyToken(req.RefreshToken)
	if err != nil {
		return nil, errors.New("refresh token tidak valid atau sudah kadaluarsa")
	}

	if payload.Type != "refresh" {
		return nil, errors.New("jenis token tidak valid")
	}

	// Pastikan bisnis masih ada (opsional, tapi disarankan)
	business, err := s.repo.GetByEmail(ctx, payload.Email)
	if err != nil {
		return nil, errors.New("bisnis tidak ditemukan")
	}

	// Generate Access Token baru
	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "access",
	}, 24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat access token baru")
	}

	return &domain.RefreshTokenResponse{
		AccessToken: accessToken,
	}, nil
}

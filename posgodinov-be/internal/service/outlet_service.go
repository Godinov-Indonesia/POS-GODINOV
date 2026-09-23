package service

import (
	"context"
	"errors"
	"fmt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/utils"
)

type outletService struct {
	repo         domain.OutletRepository
	businessRepo domain.BusinessRepository
	txManager    database.TransactionManager
}

func NewOutletService(repo domain.OutletRepository, businessRepo domain.BusinessRepository, txManager database.TransactionManager) domain.OutletService {
	return &outletService{
		repo:         repo,
		businessRepo: businessRepo,
		txManager:    txManager,
	}
}

func (s *outletService) Register(ctx context.Context, businessID string, req *domain.CreateOutletRequest) (*domain.Outlet, error) {
	if req.Name == "" {
		return nil, errors.New("nama outlet tidak boleh kosong")
	}

	var outlet *domain.Outlet
	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// 1. Dapatkan informasi bisnis (dari Landlord DB, tanpa tenant transaction)
		business, err := s.businessRepo.GetByID(context.Background(), businessID)
		if err != nil {
			return fmt.Errorf("akses ditolak: bisnis tidak ditemukan (detail: %w)", err)
		}

		// 2. Count existing outlets (safe from race condition due to parent lock)
		count, err := s.repo.CountByBusinessID(txCtx, businessID)
		if err != nil {
			return errors.New("gagal menghitung jumlah outlet")
		}

		id := utils.GenerateRandomString(6)
		
		// Serial Tenant format: SerialBusiness + 001, 002, dst
		serialTenant := fmt.Sprintf("%s%03d", business.SerialBusiness, count+1)

		outlet = &domain.Outlet{
			ID:           id,
			BusinessID:   businessID,
			SerialOutlet: serialTenant,
			Name:         req.Name,
			Address:      req.Address,
		}

		if err := s.repo.Create(txCtx, outlet); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return outlet, nil
}

func (s *outletService) GetAll(ctx context.Context, businessID string) ([]*domain.Outlet, error) {
	if businessID == "" {
		return nil, errors.New("business ID tidak boleh kosong")
	}

	outlets, err := s.repo.GetAllByBusinessID(ctx, businessID)
	if err != nil {
		return nil, errors.New("gagal mengambil daftar outlet")
	}

	return outlets, nil
}

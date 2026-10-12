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
	policyEngine domain.PolicyEngine
}

type OutletServiceOption func(*outletService)

func WithOutletPolicyEngine(pe domain.PolicyEngine) OutletServiceOption {
	return func(s *outletService) {
		s.policyEngine = pe
	}
}

func NewOutletService(repo domain.OutletRepository, businessRepo domain.BusinessRepository, txManager database.TransactionManager, opts ...OutletServiceOption) domain.OutletService {
	s := &outletService{
		repo:         repo,
		businessRepo: businessRepo,
		txManager:    txManager,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
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

		if s.policyEngine != nil {
			// PENTING: gunakan context.Background() bukan ctx di sini.
			//
			// ctx pada titik ini sudah membawa BusinessDBKey (tenant DB) dari
			// BusinessMiddleware, dan mungkin juga txKey (transaksi tenant aktif).
			// policyEngine.AssertQuota → saasRepo.GetSubscriptionByBusinessID →
			// database.GetDB(ctx, r.db) akan mendahulukan tenant DB dari context,
			// sehingga query "SELECT * FROM subscriptions" dikirim ke tenant DB yang
			// tidak memiliki tabel SaaS — menyebabkan "relation 'plans' does not
			// exist (SQLSTATE 42P01)".
			//
			// saasRepo dibuat dengan landlord DB sebagai defaultDB, dan policy engine
			// harus selalu membaca dari landlord DB. context.Background() memastikan
			// tidak ada tenant DB dari context yang bocor ke dalam saasRepo.
			if err := s.policyEngine.AssertQuota(context.Background(), businessID, "max_outlets", count+1); err != nil {
				return err
			}
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

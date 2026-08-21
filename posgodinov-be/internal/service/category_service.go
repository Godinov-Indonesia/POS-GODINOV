package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type productCategoryService struct {
	repo       domain.ProductCategoryRepository
	outletRepo domain.OutletRepository

	// v2 · butir 10 — dinaikkan bersama setiap mutasi kategori.
	versions masterVersionBumper
}

func NewProductCategoryService(
	repo domain.ProductCategoryRepository,
	outletRepo domain.OutletRepository,
	opts ...ProductCategoryServiceOption,
) domain.ProductCategoryService {
	svc := &productCategoryService{repo: repo, outletRepo: outletRepo}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// ProductCategoryServiceOption menyuntikkan dependensi v2 tanpa memecah
// pemanggil lama.
//
// Keduanya wajib hadir bersama: menaikkan versi di luar transaksi mutasinya
// justru menciptakan jendela yang hendak ditutup butir 10.
type ProductCategoryServiceOption func(*productCategoryService)

func WithCategoryMasterVersion(
	txManager database.TransactionManager,
	repo domain.MasterVersionRepository,
) ProductCategoryServiceOption {
	return func(s *productCategoryService) {
		s.versions = masterVersionBumper{txManager: txManager, repo: repo}
	}
}

func (s *productCategoryService) Create(ctx context.Context, businessID, outletID string, req *domain.CreateProductCategoryRequest) (*domain.ProductCategory, error) {
	if req.Name == "" {
		return nil, errors.New("nama kategori wajib diisi")
	}

	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	category := &domain.ProductCategory{
		OutletID:    outletID,
		Name:        req.Name,
		Description: req.Description,
	}

	err = s.versions.run(ctx, outletID, func(txCtx context.Context) error {
		if err := s.repo.Create(txCtx, category); err != nil {
			return errors.New("gagal menyimpan kategori")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return category, nil
}

func (s *productCategoryService) CreateBulk(ctx context.Context, businessID, outletID string, reqs []*domain.CreateProductCategoryRequest) ([]*domain.ProductCategory, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var categories []*domain.ProductCategory
	for _, req := range reqs {
		if req.Name == "" {
			return nil, errors.New("nama kategori wajib diisi pada salah satu item")
		}
		categories = append(categories, &domain.ProductCategory{
			OutletID:    outletID,
			Name:        req.Name,
			Description: req.Description,
		})
	}

	if len(categories) == 0 {
		return nil, errors.New("data kategori kosong")
	}

	err = s.versions.run(ctx, outletID, func(txCtx context.Context) error {
		if err := s.repo.CreateBulk(txCtx, categories); err != nil {
			return errors.New("gagal menyimpan kategori secara massal")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return categories, nil
}

func (s *productCategoryService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.ProductCategory, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	return s.repo.GetAllByOutletID(ctx, outletID)
}

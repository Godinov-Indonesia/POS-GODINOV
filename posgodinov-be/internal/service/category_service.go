package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/domain"
)

type productCategoryService struct {
	repo       domain.ProductCategoryRepository
	outletRepo domain.OutletRepository
}

func NewProductCategoryService(
	repo domain.ProductCategoryRepository,
	outletRepo domain.OutletRepository,
) domain.ProductCategoryService {
	return &productCategoryService{
		repo:       repo,
		outletRepo: outletRepo,
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

	if err := s.repo.Create(ctx, category); err != nil {
		return nil, errors.New("gagal menyimpan kategori")
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

	if err := s.repo.CreateBulk(ctx, categories); err != nil {
		return nil, errors.New("gagal menyimpan kategori secara massal")
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

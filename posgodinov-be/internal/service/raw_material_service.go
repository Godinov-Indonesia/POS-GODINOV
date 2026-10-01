package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/domain"
)

type rawMaterialService struct {
	repo       domain.RawMaterialRepository
	outletRepo domain.OutletRepository
}

func NewRawMaterialService(
	repo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
) domain.RawMaterialService {
	return &rawMaterialService{
		repo:       repo,
		outletRepo: outletRepo,
	}
}

func (s *rawMaterialService) Create(ctx context.Context, businessID, outletID string, req *domain.CreateRawMaterialRequest) (*domain.RawMaterial, error) {
	if req.Name == "" || req.Unit == "" {
		return nil, errors.New("nama bahan baku dan satuan wajib diisi")
	}
	if req.PackageStock < 0 || req.LooseStock < 0 || req.CostPerUnit < 0 {
		return nil, errors.New("stok dan harga tidak boleh negatif")
	}

	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	rm := &domain.RawMaterial{
		OutletID:           outletID,
		Name:               req.Name,
		SKU:                req.SKU,
		Unit:               req.Unit,
		PackageUnit:        req.PackageUnit,
		QuantityPerPackage: req.QuantityPerPackage,
		PackageStock:       req.PackageStock,
		LooseStock:         req.LooseStock,
		CostPerUnit:        req.CostPerUnit,
	}

	if err := s.repo.Create(ctx, rm); err != nil {
		return nil, errors.New("gagal menyimpan bahan baku")
	}

	return rm, nil
}

func (s *rawMaterialService) CreateBulk(ctx context.Context, businessID, outletID string, reqs []*domain.CreateRawMaterialRequest) ([]*domain.RawMaterial, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	var rawMaterials []*domain.RawMaterial
	for _, req := range reqs {
		if req.Name == "" || req.Unit == "" {
			return nil, errors.New("nama dan unit bahan baku tidak boleh kosong pada salah satu item")
		}
		if req.PackageStock < 0 || req.LooseStock < 0 || req.CostPerUnit < 0 {
			return nil, errors.New("stok dan harga tidak boleh negatif pada salah satu item")
		}

		rm := &domain.RawMaterial{
			OutletID:           outletID,
			Name:               req.Name,
			SKU:                req.SKU,
			Unit:               req.Unit,
			PackageUnit:        req.PackageUnit,
			QuantityPerPackage: req.QuantityPerPackage,
			PackageStock:       req.PackageStock,
			LooseStock:         req.LooseStock,
			CostPerUnit:        req.CostPerUnit,
		}
		rawMaterials = append(rawMaterials, rm)
	}

	if len(rawMaterials) == 0 {
		return nil, errors.New("data bahan baku kosong")
	}

	if err := s.repo.CreateBulk(ctx, rawMaterials); err != nil {
		return nil, errors.New("gagal menyimpan bahan baku secara massal")
	}

	return rawMaterials, nil
}

func (s *rawMaterialService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.RawMaterial, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	rawMaterials, err := s.repo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data bahan baku")
	}

	return rawMaterials, nil
}

func (s *rawMaterialService) Update(ctx context.Context, businessID, rmID string, req *domain.UpdateRawMaterialRequest) (*domain.RawMaterial, error) {
	rm, err := s.repo.GetByID(ctx, rmID)
	if err != nil {
		return nil, err
	}

	if _, err := assertOutlet(ctx, s.outletRepo, businessID, rm.OutletID); err != nil {
		return nil, err
	}

	if req.Name != "" {
		rm.Name = req.Name
	}
	rm.SKU = req.SKU
	if req.Unit != "" {
		rm.Unit = req.Unit
	}
	if req.CostPerUnit >= 0 {
		rm.CostPerUnit = req.CostPerUnit
	}
	
	rm.PackageUnit = req.PackageUnit
	rm.QuantityPerPackage = req.QuantityPerPackage

	if err := s.repo.Update(ctx, rm); err != nil {
		return nil, errors.New("gagal mengupdate bahan baku")
	}

	return rm, nil
}

func (s *rawMaterialService) Delete(ctx context.Context, businessID, rmID string) error {
	rm, err := s.repo.GetByID(ctx, rmID)
	if err != nil {
		return err
	}

	if _, err := assertOutlet(ctx, s.outletRepo, businessID, rm.OutletID); err != nil {
		return err
	}

	if err := s.repo.Delete(ctx, rmID); err != nil {
		return errors.New("gagal menghapus bahan baku")
	}

	return nil
}

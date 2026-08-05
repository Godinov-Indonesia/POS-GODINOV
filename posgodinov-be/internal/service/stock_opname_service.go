package service

import (
	"context"
	"errors"
	"math"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type stockOpnameService struct {
	repo       domain.StockOpnameRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	txManager  database.TransactionManager
}

func NewStockOpnameService(
	repo domain.StockOpnameRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	txManager database.TransactionManager,
) domain.StockOpnameService {
	return &stockOpnameService{
		repo:       repo,
		rmRepo:     rmRepo,
		outletRepo: outletRepo,
		txManager:  txManager,
	}
}

func (s *stockOpnameService) RecordOpname(ctx context.Context, businessID, outletID, rawMaterialID, actorID string, req *domain.CreateStockOpnameRequest) (*domain.StockOpname, error) {
	if req.ActualStock < 0 {
		return nil, errors.New("stok fisik aktual tidak valid")
	}

	// 1. Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdOpname *domain.StockOpname

	// 2. Gunakan Transaction Manager untuk menghindari Race Condition
	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Lock raw material untuk mencegah update stok dari transaksi lain
		rm, rmErr := s.rmRepo.LockByID(txCtx, rawMaterialID)
		if rmErr != nil || rm.OutletID != outletID {
			return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
		}

		inputType := req.InputType
		if inputType == "" {
			inputType = "base_unit"
		}
		if inputType != "base_unit" && inputType != "package_unit" {
			return errors.New("input_type harus 'base_unit' atau 'package_unit'")
		}

		actualStockBase := req.ActualStock
		systemPackageQty := float64(0)
		actualPackageQty := float64(0)

		if inputType == "package_unit" {
			if rm.QuantityPerPackage == nil || *rm.QuantityPerPackage <= 0 {
				return errors.New("bahan baku ini tidak memiliki quantity_per_package yang valid")
			}
			actualPackageQty = req.ActualStock
			actualStockBase = req.ActualStock * (*rm.QuantityPerPackage)
			systemPackageQty = rm.Stock / (*rm.QuantityPerPackage)
		}

		diff := actualStockBase - rm.Stock
		diffValue := diff * rm.CostPerUnit

		// Hitung apakah perbedaan > 5%
		fraudFlag := false
		if rm.Stock > 0 {
			diffPercentage := (math.Abs(diff) / rm.Stock) * 100
			if diffPercentage > 5 {
				fraudFlag = true
			}
		} else if diff != 0 {
			// Jika stok 0 tapi aktual tidak 0, dan selisih lumayan, flag saja
			fraudFlag = true
		}

		// Update stok jadi stok aktual
		if updateErr := s.rmRepo.UpdateStock(txCtx, rm.ID, actualStockBase); updateErr != nil {
			return errors.New("gagal mengupdate stok bahan baku")
		}

		// Catat log
		opname := &domain.StockOpname{
			OutletID:              outletID,
			RawMaterialID:         rm.ID,
			SystemStock:           rm.Stock,
			ActualStock:           actualStockBase,
			Difference:            diff,
			FraudFlag:             fraudFlag,
			RecordedBy:            actorID,
			InputType:             inputType,
			SystemPackageQuantity: systemPackageQty,
			ActualPackageQuantity: actualPackageQty,
			DifferenceValue:       diffValue,
			Notes:                 req.Notes,
		}

		if createErr := s.repo.Create(txCtx, opname); createErr != nil {
			return errors.New("gagal menyimpan catatan stock opname")
		}

		createdOpname = opname
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdOpname, nil
}

func (s *stockOpnameService) RecordBulkOpname(ctx context.Context, businessID, outletID, staffID string, reqs []*domain.CreateBulkStockOpnameRequest) ([]*domain.StockOpname, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdOpnames []*domain.StockOpname

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		rmIDs := make([]string, 0)
		rmIDMap := make(map[string]bool)
		for _, req := range reqs {
			if !rmIDMap[req.RawMaterialID] {
				rmIDMap[req.RawMaterialID] = true
				rmIDs = append(rmIDs, req.RawMaterialID)
			}
		}

		lockedRMs, rmErr := s.rmRepo.LockByIDs(txCtx, rmIDs)
		if rmErr != nil {
			return errors.New("gagal melock bahan baku")
		}

		for _, req := range reqs {
			if req.ActualStock < 0 {
				return errors.New("stok fisik aktual tidak valid pada salah satu item")
			}

			rm, exists := lockedRMs[req.RawMaterialID]
			if !exists || rm.OutletID != outletID {
				return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
			}

			inputType := req.InputType
			if inputType == "" {
				inputType = "base_unit"
			}
			if inputType != "base_unit" && inputType != "package_unit" {
				return errors.New("input_type harus 'base_unit' atau 'package_unit' pada salah satu item")
			}

			actualStockBase := req.ActualStock
			systemPackageQty := float64(0)
			actualPackageQty := float64(0)

			if inputType == "package_unit" {
				if rm.QuantityPerPackage == nil || *rm.QuantityPerPackage <= 0 {
					return errors.New("salah satu bahan baku tidak memiliki quantity_per_package yang valid")
				}
				actualPackageQty = req.ActualStock
				actualStockBase = req.ActualStock * (*rm.QuantityPerPackage)
				systemPackageQty = rm.Stock / (*rm.QuantityPerPackage)
			}

			diff := actualStockBase - rm.Stock
			diffValue := diff * rm.CostPerUnit

			fraudFlag := false
			if rm.Stock > 0 {
				diffPercentage := (math.Abs(diff) / rm.Stock) * 100
				if diffPercentage > 5 {
					fraudFlag = true
				}
			} else if diff != 0 {
				fraudFlag = true
			}

			if updateErr := s.rmRepo.UpdateStock(txCtx, rm.ID, actualStockBase); updateErr != nil {
				return errors.New("gagal mengupdate stok bahan baku")
			}

			opname := &domain.StockOpname{
				OutletID:              outletID,
				RawMaterialID:         rm.ID,
				SystemStock:           rm.Stock,
				ActualStock:           actualStockBase,
				Difference:            diff,
				FraudFlag:             fraudFlag,
				RecordedBy:            staffID,
				InputType:             inputType,
				SystemPackageQuantity: systemPackageQty,
				ActualPackageQuantity: actualPackageQty,
				DifferenceValue:       diffValue,
				Notes:                 req.Notes,
			}

			if createErr := s.repo.Create(txCtx, opname); createErr != nil {
				return errors.New("gagal menyimpan catatan stock opname")
			}
			createdOpnames = append(createdOpnames, opname)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdOpnames, nil
}

func (s *stockOpnameService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.StockOpname, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak")
	}
	return s.repo.GetAllByOutletID(ctx, outletID)
}

package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type restockLogService struct {
	repo       domain.RestockLogRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	txManager  database.TransactionManager
}

func NewRestockLogService(
	repo domain.RestockLogRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	txManager database.TransactionManager,
) domain.RestockLogService {
	return &restockLogService{
		repo:       repo,
		rmRepo:     rmRepo,
		outletRepo: outletRepo,
		txManager:  txManager,
	}
}

func (s *restockLogService) RecordRestock(ctx context.Context, businessID, outletID, rawMaterialID, actorID string, req *domain.CreateRestockLogRequest) (*domain.RestockLog, error) {
	if req.Quantity <= 0 {
		return nil, errors.New("kuantitas restock harus lebih dari 0")
	}
	if req.CostPerUnit < 0 {
		return nil, errors.New("harga per unit tidak valid")
	}

	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	var createdLog *domain.RestockLog

	// 2. Gunakan Transaction Manager
	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Lock raw material
		rm, rmErr := s.rmRepo.LockByID(txCtx, rawMaterialID)
		if rmErr != nil || rm.OutletID != outletID {
			return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
		}

		// Hitung HPP Baru (Moving Average)
		oldTotalUnits := rm.TotalStock()
		oldTotalValue := oldTotalUnits * rm.CostPerUnit
		newTotalValue := req.Quantity * req.CostPerUnit

		newPackageStock := rm.PackageStock
		newLooseStock := rm.LooseStock
		if rm.QuantityPerPackage != nil && *rm.QuantityPerPackage > 0 {
			qtyPerPkg := *rm.QuantityPerPackage
			packages := int(req.Quantity / qtyPerPkg)
			remainder := req.Quantity - float64(packages)*qtyPerPkg
			newPackageStock += packages
			newLooseStock += remainder
		} else {
			newLooseStock += req.Quantity
		}

		totalUnits := oldTotalUnits + req.Quantity
		var newCost float64
		if totalUnits > 0 {
			newCost = (oldTotalValue + newTotalValue) / totalUnits
		}

		if updateErr := s.rmRepo.UpdateDualStockAndCost(txCtx, rm.ID, newPackageStock, newLooseStock, newCost); updateErr != nil {
			return errors.New("gagal mengupdate stok dan HPP bahan baku")
		}

		// Catat log
		log := &domain.RestockLog{
			OutletID:      outletID,
			RawMaterialID: rm.ID,
			Quantity:      req.Quantity,
			CostPerUnit:   req.CostPerUnit,
			TotalCost:     req.Quantity * req.CostPerUnit,
			SupplierName:  req.SupplierName,
			RecordedBy:    actorID,
		}

		if createErr := s.repo.Create(txCtx, log); createErr != nil {
			return errors.New("gagal menyimpan catatan restock")
		}

		createdLog = log
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdLog, nil
}

func (s *restockLogService) RecordBulkRestock(ctx context.Context, businessID, outletID, staffID string, reqs []*domain.CreateBulkRestockLogRequest) ([]*domain.RestockLog, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	var createdLogs []*domain.RestockLog

	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
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
			if req.Quantity <= 0 {
				return errors.New("kuantitas restock harus lebih dari 0 pada salah satu item")
			}
			if req.CostPerUnit < 0 {
				return errors.New("harga per unit tidak valid pada salah satu item")
			}

			rm, exists := lockedRMs[req.RawMaterialID]
			if !exists || rm.OutletID != outletID {
				return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
			}

			oldTotalUnits := rm.TotalStock()
			oldTotalValue := oldTotalUnits * rm.CostPerUnit
			newTotalValue := req.Quantity * req.CostPerUnit

			newPackageStock := rm.PackageStock
			newLooseStock := rm.LooseStock
			if rm.QuantityPerPackage != nil && *rm.QuantityPerPackage > 0 {
				qtyPerPkg := *rm.QuantityPerPackage
				packages := int(req.Quantity / qtyPerPkg)
				remainder := req.Quantity - float64(packages)*qtyPerPkg
				newPackageStock += packages
				newLooseStock += remainder
			} else {
				newLooseStock += req.Quantity
			}

			totalUnits := oldTotalUnits + req.Quantity
			var newCost float64
			if totalUnits > 0 {
				newCost = (oldTotalValue + newTotalValue) / totalUnits
			}

			if updateErr := s.rmRepo.UpdateDualStockAndCost(txCtx, rm.ID, newPackageStock, newLooseStock, newCost); updateErr != nil {
				return errors.New("gagal mengupdate stok dan HPP bahan baku")
			}

			log := &domain.RestockLog{
				OutletID:      outletID,
				RawMaterialID: rm.ID,
				Quantity:      req.Quantity,
				CostPerUnit:   req.CostPerUnit,
				TotalCost:     req.Quantity * req.CostPerUnit,
				SupplierName:  req.SupplierName,
				RecordedBy:    staffID,
			}

			if createErr := s.repo.Create(txCtx, log); createErr != nil {
				return errors.New("gagal menyimpan catatan restock")
			}
			createdLogs = append(createdLogs, log)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdLogs, nil
}

func (s *restockLogService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.RestockLog, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}
	return s.repo.GetAllByOutletID(ctx, outletID)
}


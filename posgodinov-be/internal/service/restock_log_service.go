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

	// 1. Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdLog *domain.RestockLog

	// 2. Gunakan Transaction Manager
	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Lock raw material
		rm, rmErr := s.rmRepo.LockByID(txCtx, rawMaterialID)
		if rmErr != nil || rm.OutletID != outletID {
			return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
		}

		// Hitung HPP Baru (Moving Average)
		oldTotalValue := rm.Stock * rm.CostPerUnit
		newTotalValue := req.Quantity * req.CostPerUnit
		
		newStock := rm.Stock + req.Quantity
		var newCost float64
		if newStock > 0 {
			newCost = (oldTotalValue + newTotalValue) / newStock
		}

		if updateErr := s.rmRepo.UpdateStockAndCost(txCtx, rm.ID, newStock, newCost); updateErr != nil {
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
	// Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdLogs []*domain.RestockLog

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

			oldTotalValue := rm.Stock * rm.CostPerUnit
			newTotalValue := req.Quantity * req.CostPerUnit

			newStock := rm.Stock + req.Quantity
			var newCost float64
			if newStock > 0 {
				newCost = (oldTotalValue + newTotalValue) / newStock
			}

			if updateErr := s.rmRepo.UpdateStockAndCost(txCtx, rm.ID, newStock, newCost); updateErr != nil {
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
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak")
	}
	return s.repo.GetAllByOutletID(ctx, outletID)
}

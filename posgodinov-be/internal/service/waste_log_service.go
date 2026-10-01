package service

import (
	"context"
	"errors"
	"math"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type wasteLogService struct {
	repo       domain.WasteLogRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	txManager  database.TransactionManager
}

func NewWasteLogService(
	repo domain.WasteLogRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	txManager database.TransactionManager,
) domain.WasteLogService {
	return &wasteLogService{
		repo:       repo,
		rmRepo:     rmRepo,
		outletRepo: outletRepo,
		txManager:  txManager,
	}
}

func (s *wasteLogService) RecordWaste(ctx context.Context, businessID, outletID, rawMaterialID, actorID string, req *domain.CreateWasteLogRequest) (*domain.WasteLog, error) {
	if req.Quantity <= 0 {
		return nil, errors.New("kuantitas waste harus lebih dari 0")
	}
	if req.Reason == "" {
		return nil, errors.New("alasan waste wajib diisi")
	}

	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	var createdLog *domain.WasteLog

	// 2. Gunakan Transaction Manager untuk menghindari Race Condition saat update stok
	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Lock raw material untuk mencegah update bersamaan
		rm, rmErr := s.rmRepo.LockByID(txCtx, rawMaterialID)
		if rmErr != nil || rm.OutletID != outletID {
			return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
		}

		if rm.TotalStock() < req.Quantity {
			return errors.New("stok bahan baku tidak mencukupi untuk dicatat sebagai waste")
		}

		newPkg, newLoose := deductWasteStock(rm, req.Quantity)
		if updateErr := s.rmRepo.UpdateDualStock(txCtx, rm.ID, newPkg, newLoose); updateErr != nil {
			return errors.New("gagal memotong stok bahan baku")
		}

		// Catat log
		log := &domain.WasteLog{
			OutletID:      outletID,
			RawMaterialID: rm.ID,
			Quantity:      req.Quantity,
			Reason:        req.Reason,
			RecordedBy:    actorID,
		}

		if createErr := s.repo.Create(txCtx, log); createErr != nil {
			return errors.New("gagal menyimpan catatan waste")
		}

		createdLog = log
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdLog, nil
}

func (s *wasteLogService) RecordBulkWaste(ctx context.Context, businessID, outletID, staffID string, reqs []*domain.CreateBulkWasteLogRequest) ([]*domain.WasteLog, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}

	var createdLogs []*domain.WasteLog

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
				return errors.New("kuantitas waste harus lebih dari 0 pada salah satu item")
			}
			if req.Reason == "" {
				return errors.New("alasan waste wajib diisi pada salah satu item")
			}

			rm, exists := lockedRMs[req.RawMaterialID]
			if !exists || rm.OutletID != outletID {
				return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
			}

			if rm.TotalStock() < req.Quantity {
				return errors.New("stok bahan baku tidak mencukupi untuk dicatat sebagai waste pada bahan baku " + rm.Name)
			}

			newPkg, newLoose := deductWasteStock(rm, req.Quantity)
			if updateErr := s.rmRepo.UpdateDualStock(txCtx, rm.ID, newPkg, newLoose); updateErr != nil {
				return errors.New("gagal memotong stok bahan baku")
			}

			log := &domain.WasteLog{
				OutletID:      outletID,
				RawMaterialID: rm.ID,
				Quantity:      req.Quantity,
				Reason:        req.Reason,
				RecordedBy:    staffID,
			}

			if createErr := s.repo.Create(txCtx, log); createErr != nil {
				return errors.New("gagal menyimpan catatan waste")
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

func (s *wasteLogService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.WasteLog, error) {
	if _, err := assertOutlet(ctx, s.outletRepo, businessID, outletID); err != nil {
		return nil, err
	}
	return s.repo.GetAllByOutletID(ctx, outletID)
}

func deductWasteStock(rm *domain.RawMaterial, qty float64) (int, float64) {
	pkgStock, looseStock := rm.PackageStock, rm.LooseStock
	if looseStock < qty && pkgStock > 0 && rm.QuantityPerPackage != nil && *rm.QuantityPerPackage > 0 {
		deficit := qty - looseStock
		qtyPerPkg := *rm.QuantityPerPackage
		needed := int(math.Ceil(deficit / qtyPerPkg))
		if needed > pkgStock {
			needed = pkgStock
		}
		pkgStock -= needed
		looseStock += float64(needed) * qtyPerPkg
	}
	return pkgStock, looseStock - qty
}


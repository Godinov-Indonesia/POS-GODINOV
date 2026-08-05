package service

import (
	"context"
	"errors"

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

	// 1. Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdLog *domain.WasteLog

	// 2. Gunakan Transaction Manager untuk menghindari Race Condition saat update stok
	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Lock raw material untuk mencegah update bersamaan
		rm, rmErr := s.rmRepo.LockByID(txCtx, rawMaterialID)
		if rmErr != nil || rm.OutletID != outletID {
			return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
		}

		if rm.Stock < req.Quantity {
			return errors.New("stok bahan baku tidak mencukupi untuk dicatat sebagai waste")
		}

		// Kurangi stok
		newStock := rm.Stock - req.Quantity
		if updateErr := s.rmRepo.UpdateStock(txCtx, rm.ID, newStock); updateErr != nil {
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
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdLogs []*domain.WasteLog

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
				return errors.New("kuantitas waste harus lebih dari 0 pada salah satu item")
			}
			if req.Reason == "" {
				return errors.New("alasan waste wajib diisi pada salah satu item")
			}

			rm, exists := lockedRMs[req.RawMaterialID]
			if !exists || rm.OutletID != outletID {
				return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
			}

			if rm.Stock < req.Quantity {
				return errors.New("stok bahan baku tidak mencukupi untuk dicatat sebagai waste pada bahan baku " + rm.Name)
			}

			newStock := rm.Stock - req.Quantity
			if updateErr := s.rmRepo.UpdateStock(txCtx, rm.ID, newStock); updateErr != nil {
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
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak")
	}
	return s.repo.GetAllByOutletID(ctx, outletID)
}

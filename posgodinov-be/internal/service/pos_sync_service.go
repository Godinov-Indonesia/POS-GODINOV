package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type posSyncService struct {
	staffRepo    domain.StaffRepository
	categoryRepo domain.ProductCategoryRepository
	productRepo  domain.ProductRepository
	posRepo      domain.POSRepository
	rawMatRepo   domain.RawMaterialRepository
	txManager    database.TransactionManager
}

func NewPOSSyncService(
	staffRepo domain.StaffRepository,
	categoryRepo domain.ProductCategoryRepository,
	productRepo domain.ProductRepository,
	posRepo domain.POSRepository,
	rawMatRepo domain.RawMaterialRepository,
	txManager database.TransactionManager,
) domain.POSSyncService {
	return &posSyncService{
		staffRepo:    staffRepo,
		categoryRepo: categoryRepo,
		productRepo:  productRepo,
		posRepo:      posRepo,
		rawMatRepo:   rawMatRepo,
		txManager:    txManager,
	}
}

func (s *posSyncService) GetMasterData(ctx context.Context, businessID, outletID string) (*domain.SyncMasterDataResponse, error) {
	// Peringatan: Kita harus memastikan Outlet ini benar milik BusinessID yang melakukan request.
	// Namun pengecekan ownership ini idealnya dilakukan di middleware/handler menggunakan token.
	
	staffs, err := s.staffRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data staf")
	}

	categories, err := s.categoryRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data kategori")
	}

	products, err := s.productRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data produk")
	}

	var posStaffs []*domain.POSMasterStaff
	for _, s := range staffs {
		posStaffs = append(posStaffs, &domain.POSMasterStaff{
			ID:              s.ID,
			StaffIdentifier: s.StaffIdentifier,
			Name:            s.Name,
			PINHash:         s.PINHash,
		})
	}

	var posCategories []*domain.POSMasterCategory
	for _, c := range categories {
		posCategories = append(posCategories, &domain.POSMasterCategory{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
		})
	}

	var posProducts []*domain.POSMasterProduct
	for _, p := range products {
		posProducts = append(posProducts, &domain.POSMasterProduct{
			ID:         p.ID,
			Name:       p.Name,
			Price:      p.Price,
			ImageURL:   p.ImageURL,
			CategoryID: p.CategoryID,
		})
	}

	return &domain.SyncMasterDataResponse{
		Staffs:     posStaffs,
		Categories: posCategories,
		Products:   posProducts,
	}, nil
}

func (s *posSyncService) SyncUp(ctx context.Context, businessID, outletID string, req *domain.SyncUpRequest) (*domain.SyncUpResponse, error) {
	resp := &domain.SyncUpResponse{
		FailedTransactions: make([]string, 0),
	}

	// 1. Process Shifts
	for _, shift := range req.Shifts {
		// Ensure shift data matches the authenticating token
		shift.BusinessID = businessID
		shift.OutletID = outletID
		if err := s.posRepo.SaveShift(ctx, shift); err != nil {
			// Skip or log error, but for sync we usually just continue
			continue
		}
		resp.ShiftsSynced++
	}

	// 2. Process Transactions
	for _, trx := range req.Transactions {
		trx.BusinessID = businessID
		trx.OutletID = outletID
		
		err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
			// Idempotency Check
			existingTrx, err := s.posRepo.GetTransactionByID(txCtx, trx.ID)
			if err == nil && existingTrx != nil {
				// If it exists, we only care if the incoming status is CANCELLED but existing is COMPLETED
				if existingTrx.Status == "COMPLETED" && trx.Status == "CANCELLED" {
					return s.handleCancelTransaction(txCtx, trx)
				}
				// Otherwise, it's a duplicate, do nothing (Idempotency)
				return nil
			}

			// New Transaction
			if err := s.posRepo.SaveTransaction(txCtx, trx); err != nil {
				return err
			}

			if trx.Status == "COMPLETED" {
				return s.deductBOMStock(txCtx, trx, false)
			} else if trx.Status == "CANCELLED" {
				// Already cancelled locally before ever syncing? Do nothing to stock.
				return nil
			}
			return nil
		})

		if err != nil {
			resp.FailedTransactions = append(resp.FailedTransactions, trx.ID)
		} else {
			resp.TransactionsSynced++
		}
	}

	// 3. Process Product Wastes
	for _, waste := range req.Wastes {
		waste.BusinessID = businessID
		waste.OutletID = outletID
		
		err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
			existingWaste, err := s.posRepo.GetProductWasteByID(txCtx, waste.ID)
			if err == nil && existingWaste != nil {
				return nil // duplicate
			}

			if err := s.posRepo.SaveProductWaste(txCtx, waste); err != nil {
				return err
			}

			// Deduct RM for waste
			return s.deductBOMStockForWaste(txCtx, waste)
		})

		if err == nil {
			resp.WastesSynced++
		}
	}

	return resp, nil
}

func (s *posSyncService) handleCancelTransaction(ctx context.Context, trx *domain.Transaction) error {
	// Reverse Deduction
	if err := s.deductBOMStock(ctx, trx, true); err != nil {
		return err
	}
	
	// Update Status
	return s.posRepo.UpdateTransactionStatus(ctx, trx.ID, "CANCELLED", trx.CancelNotes)
}

func (s *posSyncService) deductBOMStock(ctx context.Context, trx *domain.Transaction, isReverse bool) error {
	for _, item := range trx.Items {
		product, err := s.productRepo.GetByID(ctx, item.ProductID)
		if err != nil {
			continue // Skip if product doesn't exist anymore, tolerate for POS
		}

		for _, recipe := range product.Recipes {
			rm, err := s.rawMatRepo.LockByID(ctx, recipe.RawMaterialID)
			if err != nil {
				continue
			}

			amountToDeduct := recipe.Quantity * float64(item.Quantity)
			
			if isReverse {
				rm.Stock += amountToDeduct // Refund
			} else {
				rm.Stock -= amountToDeduct // Allow negative
			}

			if err := s.rawMatRepo.Update(ctx, rm); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *posSyncService) deductBOMStockForWaste(ctx context.Context, waste *domain.ProductWaste) error {
	product, err := s.productRepo.GetByID(ctx, waste.ProductID)
	if err != nil {
		return nil
	}

	for _, recipe := range product.Recipes {
		rm, err := s.rawMatRepo.LockByID(ctx, recipe.RawMaterialID)
		if err != nil {
			continue
		}

		amountToDeduct := recipe.Quantity * float64(waste.Quantity)
		rm.Stock -= amountToDeduct

		if err := s.rawMatRepo.Update(ctx, rm); err != nil {
			return err
		}
	}
	return nil
}

func (s *posSyncService) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	if limit <= 0 {
		limit = 50 // default limit
	}
	if limit > 100 {
		limit = 100 // max limit
	}
	
	return s.posRepo.GetTransactions(ctx, outletID, limit, offset)
}

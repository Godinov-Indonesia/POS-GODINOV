package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

var (
	ErrSOFormNotOpen     = errors.New("form SO tidak berstatus OPEN")
	ErrSOFormNotCounting = errors.New("form SO tidak berstatus COUNTING")
	ErrSOFormNotClosed   = errors.New("form SO tidak berstatus CLOSED")
	ErrSOFormForbidden   = errors.New("form SO bukan milik outlet ini")
	ErrSOFormNoItems     = errors.New("form SO tidak memiliki material")
	ErrSOFormNoCounts    = errors.New("belum ada hitungan yang disubmit")
	ErrSOStaffNotFound  = errors.New("staff tidak ditemukan")
	ErrSOStaffForbidden = errors.New("staff bukan anggota outlet ini")
	ErrSOStaffInactive  = errors.New("staff tidak aktif")
)

type opnameSessionService struct {
	repo       domain.OpnameSessionRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	staffRepo  domain.StaffRepository
	txManager  database.TransactionManager
	now        func() time.Time
}

type OpnameSessionOption func(*opnameSessionService)

func WithSOStaffRepository(repo domain.StaffRepository) OpnameSessionOption {
	return func(s *opnameSessionService) {
		s.staffRepo = repo
	}
}

func NewOpnameSessionService(
	repo domain.OpnameSessionRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	txManager database.TransactionManager,
	opts ...OpnameSessionOption,
) domain.OpnameSessionService {
	s := &opnameSessionService{repo: repo, rmRepo: rmRepo, outletRepo: outletRepo, txManager: txManager, now: time.Now}
	for _, opt := range opts {
		opt(s)
	}
	return s
}


// ── Helpers ──────────────────────────────────────────────────────────────

func (s *opnameSessionService) assertOutlet(ctx context.Context, businessID, outletID string) error {
	_, err := assertOutlet(ctx, s.outletRepo, businessID, outletID)
	return err
}

func (s *opnameSessionService) assertStaff(ctx context.Context, outletID, staffID string) (*domain.Staff, error) {
	if s.staffRepo == nil || staffID == "" {
		return nil, nil
	}
	staff, err := s.staffRepo.GetByID(ctx, staffID)
	if err != nil || staff == nil {
		return nil, ErrSOStaffNotFound
	}
	if staff.OutletID != outletID {
		return nil, ErrSOStaffForbidden
	}
	if !staff.IsActive || staff.IsDeleted {
		return nil, ErrSOStaffInactive
	}
	return staff, nil
}


func (s *opnameSessionService) loadSession(ctx context.Context, businessID, outletID, formID string) (*domain.OpnameSession, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}
	session, err := s.repo.GetByID(ctx, formID)
	if err != nil {
		return nil, err
	}
	if session.OutletID != outletID || session.BusinessID != businessID {
		return nil, ErrSOFormForbidden
	}
	return session, nil
}

func (s *opnameSessionService) rawMaterialCatalog(ctx context.Context, outletID string) (map[string]*domain.RawMaterial, error) {
	rms, err := s.rmRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, err
	}
	catalog := make(map[string]*domain.RawMaterial)
	for _, rm := range rms {
		catalog[rm.ID] = rm
	}
	return catalog, nil
}

func deref(v *float64) float64 {
	if v == nil { return 0 }
	return *v
}

func derefInt(v *int) int {
	if v == nil { return 0 }
	return *v
}



func (s *opnameSessionService) buildFormResponse(ctx context.Context, session *domain.OpnameSession) (*domain.SOFormResponse, error) {
	catalog, err := s.rawMaterialCatalog(ctx, session.OutletID)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListFormItems(ctx, session.ID)
	if err != nil {
		return nil, err
	}

	materialDTOs := make([]*domain.SOFormMaterialDTO, 0, len(items))
	for _, item := range items {
		rm, ok := catalog[item.RawMaterialID]
		if !ok {
			continue
		}
		materialDTOs = append(materialDTOs, &domain.SOFormMaterialDTO{
			RawMaterialID:      rm.ID,
			RawMaterialName:    rm.Name,
			SKU:                rm.SKU,
			Unit:               rm.Unit,
			PackageUnit:        rm.PackageUnit,
			QuantityPerPackage: rm.QuantityPerPackage,
		})
	}

	resp := &domain.SOFormResponse{
		ID:            session.ID,
		OutletID:      session.OutletID,
		Status:        session.Status,
		Scope:         session.Scope,
		Notes:         session.Notes,
		CreatedBy:     session.CreatedBy,
		RecountOf:     session.RecountOf,
		RecountNumber: session.RecountNumber,
		PublishedAt:   session.PublishedAt,
		ClosedAt:      session.ClosedAt,
		CreatedAt:     session.CreatedAt,
		Materials:     materialDTOs,
	}

	if session.Status == domain.SOStatusCounting || session.Status == domain.SOStatusPublished {
		hasCounts, _ := s.repo.HasCountEntries(ctx, session.ID)
		total := len(items)
		var counted int
		countersMap := make(map[string]bool)

		if hasCounts {
			entries, err := s.repo.ListCountEntries(ctx, session.ID)
			if err == nil {
				countedMaterials := make(map[string]bool)
				for _, entry := range entries {
					countedMaterials[entry.RawMaterialID] = true
					countersMap[entry.CountedBy] = true
				}
				counted = len(countedMaterials)
			}
		}

		counters := make([]string, 0)
		for k := range countersMap {
			counters = append(counters, k)
		}

		resp.CountProgress = &domain.SOCountProgress{
			TotalMaterials:   total,
			CountedMaterials: counted,
			Counters:         counters,
		}
	}

	return resp, nil
}

func (s *opnameSessionService) buildClosedResponse(ctx context.Context, session *domain.OpnameSession) (*domain.SOClosedResponse, error) {
	catalog, err := s.rawMaterialCatalog(ctx, session.OutletID)
	if err != nil {
		return nil, err
	}

	entries, err := s.repo.ListCountEntries(ctx, session.ID)
	if err != nil {
		return nil, err
	}

	sheetsMap := make(map[string]*domain.SOCountSheet)
	for _, entry := range entries {
		sheet, ok := sheetsMap[entry.CountedBy]
		if !ok {
			staffName := entry.CountedBy
			if s.staffRepo != nil {
				if st, err := s.staffRepo.GetByID(ctx, entry.CountedBy); err == nil && st != nil {
					staffName = st.Name
				}
			}
			sheet = &domain.SOCountSheet{
				CountedBy: entry.CountedBy,
				StaffName: staffName,
				Items:     []*domain.SOCountSheetItem{},
			}
			sheetsMap[entry.CountedBy] = sheet
		}

		rmName := "Unknown"
		unit := ""
		if rm, ok := catalog[entry.RawMaterialID]; ok {
			rmName = rm.Name
			unit = rm.Unit
		}

		sheet.Items = append(sheet.Items, &domain.SOCountSheetItem{
			RawMaterialID:   entry.RawMaterialID,
			RawMaterialName: rmName,
			Unit:            unit,
			ActualPackages:  entry.ActualPackages,
			ActualLoose:     entry.ActualLoose,
			ActualStock:     entry.ActualStock,
			Notes:           entry.Notes,
		})
	}

	var countSheets []*domain.SOCountSheet
	for _, sheet := range sheetsMap {
		countSheets = append(countSheets, sheet)
	}

	sessionItems, err := s.repo.ListItems(ctx, session.ID)
	if err != nil {
		return nil, err
	}

	var finalItems []*domain.SOFinalSheetItem
	var itemsCounted, itemsWithVariance, fraudFlaggedItems int
	var totalVarianceValue float64

	for _, item := range sessionItems {
		rm, ok := catalog[item.RawMaterialID]
		if !ok {
			continue
		}

		fItem := &domain.SOFinalSheetItem{
			RawMaterialID:      item.RawMaterialID,
			RawMaterialName:    rm.Name,
			Unit:               rm.Unit,
			PackageUnit:        rm.PackageUnit,
			QuantityPerPackage: rm.QuantityPerPackage,
			SystemPackageStock: derefInt(item.SystemPackageStock),
			SystemLooseStock:   deref(item.SystemLooseStock),
			SystemStock:        deref(item.SystemStock),
			ActualPackages:     derefInt(item.ActualPackages),
			ActualLoose:        deref(item.ActualLoose),
			ActualStock:        item.ActualStock,
			Difference:         deref(item.Difference),
			DifferenceValue:    deref(item.DifferenceValue),
			FraudFlag:          item.FraudFlag,
		}

		finalItems = append(finalItems, fItem)
		itemsCounted++
		if math.Abs(fItem.Difference) > 0.0001 {
			itemsWithVariance++
		}
		if fItem.FraudFlag {
			fraudFlaggedItems++
		}
		totalVarianceValue += fItem.DifferenceValue
	}

	finalSheet := &domain.SOFinalSheet{
		Summary: domain.SOFinalSummary{
			TotalItems:           itemsCounted,
			MatchedItems:         itemsCounted - itemsWithVariance,
			DifferentItems:       itemsWithVariance,
			FraudFlaggedItems:    fraudFlaggedItems,
			TotalDifferenceValue: totalVarianceValue,
			ItemsCounted:         itemsCounted,
			ItemsWithVariance:    itemsWithVariance,
			TotalVarianceValue:   totalVarianceValue,
		},
		Items: finalItems,
	}

	var history []*domain.SOHistoryEntry
	if session.RecountOf != nil {
		chain, err := s.repo.GetRecountChain(ctx, session.ID)
		if err == nil {
			for _, ch := range chain {
				label := "Original"
				if ch.RecountNumber > 0 {
					label = fmt.Sprintf("Recount ke-%d", ch.RecountNumber)
				}
				history = append(history, &domain.SOHistoryEntry{
					ID:            ch.ID,
					RecountNumber: ch.RecountNumber,
					Status:        ch.Status,
					ClosedAt:      ch.ClosedAt,
					Label:         label,
				})
			}
		}
	}

	return &domain.SOClosedResponse{
		ID:            session.ID,
		OutletID:      session.OutletID,
		Status:        session.Status,
		Scope:         session.Scope,
		Notes:         session.Notes,
		CreatedBy:     session.CreatedBy,
		RecountOf:     session.RecountOf,
		RecountNumber: session.RecountNumber,
		PublishedAt:   session.PublishedAt,
		ClosedAt:      session.ClosedAt,
		CreatedAt:     session.CreatedAt,
		CountSheets:   countSheets,
		FinalSheet:    finalSheet,
		History:       history,
	}, nil
}

// ── Admin Methods ────────────────────────────────────────────────────────

func (s *opnameSessionService) CreateForm(ctx context.Context, businessID, outletID, createdBy string, req *domain.CreateSOFormRequest) (*domain.SOFormResponse, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}

	catalog, err := s.rawMaterialCatalog(ctx, outletID)
	if err != nil {
		return nil, err
	}

	if req.Scope == "" {
		req.Scope = domain.SOScopeFull
	}

	if req.Scope == domain.SOScopeFull && len(req.RawMaterialIDs) == 0 {
		for id := range catalog {
			req.RawMaterialIDs = append(req.RawMaterialIDs, id)
		}
	}

	if len(req.RawMaterialIDs) == 0 {
		return nil, errors.New("daftar material tidak boleh kosong")
	}

	for _, id := range req.RawMaterialIDs {
		if _, ok := catalog[id]; !ok {
			return nil, fmt.Errorf("material dengan ID %s tidak ditemukan di outlet ini", id)
		}
	}

	id := req.ID
	if id == "" {
		id = utils.NewUUID()
	}

	session := &domain.OpnameSession{
		ID:            id,
		OutletID:      outletID,
		BusinessID:    businessID,
		Scope:         req.Scope,
		Status:        domain.SOStatusOpen,
		CreatedBy:     createdBy,
		Notes:         req.Notes,
		CreatedAt:     s.now(),
	}

	if err := s.repo.Create(ctx, session); err != nil {
		return nil, err
	}

	if err := s.repo.SetFormItems(ctx, session.ID, req.RawMaterialIDs); err != nil {
		return nil, err
	}

	return s.buildFormResponse(ctx, session)
}

func (s *opnameSessionService) UpdateFormItems(ctx context.Context, businessID, outletID, formID string, rawMaterialIDs []string) (*domain.SOFormResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	if session.Status != domain.SOStatusOpen {
		return nil, ErrSOFormNotOpen
	}

	catalog, err := s.rawMaterialCatalog(ctx, outletID)
	if err != nil {
		return nil, err
	}

	for _, id := range rawMaterialIDs {
		if _, ok := catalog[id]; !ok {
			return nil, fmt.Errorf("material dengan ID %s tidak ditemukan di outlet ini", id)
		}
	}

	if err := s.repo.SetFormItems(ctx, session.ID, rawMaterialIDs); err != nil {
		return nil, err
	}

	return s.buildFormResponse(ctx, session)
}

func (s *opnameSessionService) PublishForm(ctx context.Context, businessID, outletID, formID string) error {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return err
	}

	if session.Status != domain.SOStatusOpen {
		return ErrSOFormNotOpen
	}

	items, err := s.repo.ListFormItems(ctx, session.ID)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return ErrSOFormNoItems
	}

	return s.repo.Publish(ctx, session.ID, s.now())
}

func (s *opnameSessionService) CloseForm(ctx context.Context, businessID, outletID, formID, closedBy string) (*domain.SOClosedResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	if session.Status != domain.SOStatusCounting {
		return nil, ErrSOFormNotCounting
	}

	hasCounts, err := s.repo.HasCountEntries(ctx, session.ID)
	if err != nil {
		return nil, err
	}
	if !hasCounts {
		return nil, ErrSOFormNoCounts
	}

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		return s.repo.Close(txCtx, session.ID, s.now(), closedBy)
	})
	if err != nil {
		return nil, err
	}

	// Reload session to get updated status and timestamps
	closedSession, err := s.repo.GetByID(ctx, session.ID)
	if err != nil {
		return nil, err
	}

	return s.buildClosedResponse(ctx, closedSession)
}

func (s *opnameSessionService) ApproveForm(ctx context.Context, businessID, outletID, formID, approvedBy string) (*domain.OpnameApproveResult, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	if session.Status != domain.SOStatusClosed {
		return nil, ErrSOFormNotClosed
	}

	var itemsAdjusted int
	var totalVariance float64

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		if err := s.repo.Approve(txCtx, session.ID, approvedBy, s.now()); err != nil {
			return err
		}

		items, err := s.repo.ListItems(txCtx, session.ID)
		if err != nil {
			return err
		}

		for _, it := range items {
			if it.SystemStock != nil && it.Difference != nil && *it.Difference != 0 {
				rm, err := s.rmRepo.LockByID(txCtx, it.RawMaterialID)
				if err != nil {
					return err
				}

				newPackageStock := 0
				newLooseStock := it.ActualStock
				if it.ActualPackages != nil {
					newPackageStock = *it.ActualPackages
				}
				if it.ActualLoose != nil {
					newLooseStock = *it.ActualLoose
				}

				if err := s.rmRepo.UpdateDualStock(txCtx, rm.ID, newPackageStock, newLooseStock); err != nil {
					return err
				}

				itemsAdjusted++
				if it.DifferenceValue != nil {
					totalVariance += *it.DifferenceValue
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &domain.OpnameApproveResult{
		SessionID:     session.ID,
		Status:        domain.SOStatusApproved,
		ItemsAdjusted: itemsAdjusted,
		TotalVariance: totalVariance,
	}, nil
}

func (s *opnameSessionService) RejectForm(ctx context.Context, businessID, outletID, formID, rejectedBy string) error {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return err
	}

	if session.Status != domain.SOStatusClosed {
		return ErrSOFormNotClosed
	}

	return s.repo.Reject(ctx, session.ID, rejectedBy, s.now())
}

func (s *opnameSessionService) RecountForm(ctx context.Context, businessID, outletID, formID, createdBy string) (*domain.SOFormResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	if session.Status != domain.SOStatusClosed && session.Status != domain.SOStatusRejected {
		return nil, errors.New("form SO harus berstatus CLOSED atau REJECTED untuk bisa di-recount")
	}

	items, err := s.repo.ListFormItems(ctx, session.ID)
	if err != nil {
		return nil, err
	}

	newSessionID := utils.NewUUID()
	recountOf := session.ID

	newSession := &domain.OpnameSession{
		ID:            newSessionID,
		OutletID:      outletID,
		BusinessID:    businessID,
		Scope:         session.Scope,
		Status:        domain.SOStatusOpen,
		CreatedBy:     createdBy,
		RecountOf:     &recountOf,
		RecountNumber: session.RecountNumber + 1,
		Notes:         fmt.Sprintf("Recount dari form %s", session.ID),
		CreatedAt:     s.now(),
	}

	if err := s.repo.Create(ctx, newSession); err != nil {
		return nil, err
	}

	var rmIDs []string
	for _, it := range items {
		rmIDs = append(rmIDs, it.RawMaterialID)
	}

	if err := s.repo.SetFormItems(ctx, newSession.ID, rmIDs); err != nil {
		return nil, err
	}

	return s.buildFormResponse(ctx, newSession)
}

func (s *opnameSessionService) GetFormDetail(ctx context.Context, businessID, outletID, formID string) (interface{}, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	switch session.Status {
	case domain.SOStatusOpen, domain.SOStatusPublished, domain.SOStatusCounting:
		return s.buildFormResponse(ctx, session)
	case domain.SOStatusClosed, domain.SOStatusApproved, domain.SOStatusRejected:
		return s.buildClosedResponse(ctx, session)
	default:
		return nil, errors.New("status form tidak valid")
	}
}

func (s *opnameSessionService) ListForms(ctx context.Context, businessID, outletID, status string, limit, offset int) ([]*domain.SOFormResponse, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}

	var statuses []string
	if status != "" {
		statuses = append(statuses, status)
	}

	sessions, err := s.repo.ListByOutlet(ctx, outletID, statuses, limit, offset)
	if err != nil {
		return nil, err
	}

	responses := make([]*domain.SOFormResponse, 0)
	for _, session := range sessions {
		responses = append(responses, &domain.SOFormResponse{
			ID:            session.ID,
			OutletID:      session.OutletID,
			Status:        session.Status,
			Scope:         session.Scope,
			Notes:         session.Notes,
			CreatedBy:     session.CreatedBy,
			RecountOf:     session.RecountOf,
			RecountNumber: session.RecountNumber,
			PublishedAt:   session.PublishedAt,
			ClosedAt:      session.ClosedAt,
			CreatedAt:     session.CreatedAt,
		})
	}

	return responses, nil
}

// ── Mobile / App Methods ──────────────────────────────────────────────────

func (s *opnameSessionService) ListAvailable(ctx context.Context, businessID, outletID string) ([]*domain.SOFormResponse, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}

	statuses := []string{domain.SOStatusPublished, domain.SOStatusCounting}
	sessions, err := s.repo.ListByOutlet(ctx, outletID, statuses, 100, 0)
	if err != nil {
		return nil, err
	}

	responses := make([]*domain.SOFormResponse, 0)
	for _, session := range sessions {
		resp, err := s.buildFormResponse(ctx, session)
		if err != nil {
			return nil, err
		}
		// Di list available, sembunyikan detail materials agar response ringkas
		// Kasir akan melihat detail materials saat membuka form spesifik via GET /v1/so/{form_id}
		resp.Materials = nil
		responses = append(responses, resp)
	}

	return responses, nil
}

func (s *opnameSessionService) GetFormForCounting(ctx context.Context, businessID, outletID, formID string) (*domain.SOFormResponse, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	if session.Status != domain.SOStatusPublished && session.Status != domain.SOStatusCounting {
		return nil, errors.New("form SO tidak dalam status yang dapat dihitung")
	}

	return s.buildFormResponse(ctx, session)
}

func (s *opnameSessionService) SubmitCounts(ctx context.Context, businessID, outletID, formID, staffID string, items []*domain.SubmitCountItemRequest) error {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return err
	}

	if _, err := s.assertStaff(ctx, outletID, staffID); err != nil {
		return err
	}

	if session.Status != domain.SOStatusPublished && session.Status != domain.SOStatusCounting {
		return errors.New("form SO tidak dalam status yang dapat disubmit")
	}

	formItems, err := s.repo.ListFormItems(ctx, session.ID)
	if err != nil {
		return err
	}

	validMaterials := make(map[string]bool)
	for _, it := range formItems {
		validMaterials[it.RawMaterialID] = true
	}

	catalog, err := s.rawMaterialCatalog(ctx, outletID)
	if err != nil {
		return err
	}

	var entries []*domain.OpnameCountEntry
	for _, reqItem := range items {
		if !validMaterials[reqItem.RawMaterialID] {
			return fmt.Errorf("material dengan ID %s tidak ada dalam form ini", reqItem.RawMaterialID)
		}

		if _, ok := catalog[reqItem.RawMaterialID]; !ok {
			return fmt.Errorf("material dengan ID %s tidak ditemukan", reqItem.RawMaterialID)
		}

		rm := catalog[reqItem.RawMaterialID]
		qtyPerPkg := 0.0
		if rm.QuantityPerPackage != nil {
			qtyPerPkg = *rm.QuantityPerPackage
		}
		actualStock := float64(reqItem.ActualPackages)*qtyPerPkg + reqItem.ActualLoose

		entryID := utils.NewUUID()
		entries = append(entries, &domain.OpnameCountEntry{
			ID:             entryID,
			SessionID:      session.ID,
			RawMaterialID:  reqItem.RawMaterialID,
			CountedBy:      staffID,
			ActualPackages: reqItem.ActualPackages,
			ActualLoose:    reqItem.ActualLoose,
			ActualStock:    actualStock,
			Notes:          reqItem.Notes,
			CreatedAt:      s.now(),
			UpdatedAt:      s.now(),
		})
	}

	if err := s.repo.UpsertCountEntries(ctx, entries); err != nil {
		return err
	}

	if session.Status == domain.SOStatusPublished {
		if err := s.repo.MarkCounting(ctx, session.ID); err != nil {
			return err
		}
	}

	return nil
}

func (s *opnameSessionService) GetMyCounts(ctx context.Context, businessID, outletID, formID, staffID string) (*domain.SOCountSheet, error) {
	session, err := s.loadSession(ctx, businessID, outletID, formID)
	if err != nil {
		return nil, err
	}

	staff, err := s.assertStaff(ctx, outletID, staffID)
	if err != nil {
		return nil, err
	}

	entries, err := s.repo.ListCountEntriesByStaff(ctx, session.ID, staffID)
	if err != nil {
		return nil, err
	}

	catalog, err := s.rawMaterialCatalog(ctx, outletID)
	if err != nil {
		return nil, err
	}

	staffName := staffID
	if staff != nil {
		staffName = staff.Name
	}

	sheet := &domain.SOCountSheet{
		CountedBy: staffID,
		StaffName: staffName,
		Items:     []*domain.SOCountSheetItem{},
	}


	for _, entry := range entries {
		rmName := "Unknown"
		unit := ""
		if rm, ok := catalog[entry.RawMaterialID]; ok {
			rmName = rm.Name
			unit = rm.Unit
		}

		sheet.Items = append(sheet.Items, &domain.SOCountSheetItem{
			RawMaterialID:   entry.RawMaterialID,
			RawMaterialName: rmName,
			Unit:            unit,
			ActualPackages:  entry.ActualPackages,
			ActualLoose:     entry.ActualLoose,
			ActualStock:     entry.ActualStock,
			Notes:           entry.Notes,
		})
	}

	return sheet, nil
}

func (s *opnameSessionService) GetStaffData(ctx context.Context, businessID, outletID string) ([]*domain.POSMasterStaff, error) {
	if err := s.assertOutlet(ctx, businessID, outletID); err != nil {
		return nil, err
	}
	if s.staffRepo == nil {
		return []*domain.POSMasterStaff{}, nil
	}
	staffs, err := s.staffRepo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal memuat data staf")
	}
	var res []*domain.POSMasterStaff
	for _, st := range staffs {
		if !st.IsActive {
			continue
		}
		res = append(res, &domain.POSMasterStaff{
			ID:              st.ID,
			StaffIdentifier: st.StaffIdentifier,
			Name:            st.Name,
			PINHash:         st.PINHash,
			Role:            st.Role,
			Permissions:     st.Permissions,
		})
	}
	return res, nil
}

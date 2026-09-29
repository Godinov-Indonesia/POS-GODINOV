package unit

import (
	"context"
	"errors"
	"testing"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type mockOpnameSessionRepo struct {
	sessions     map[string]*domain.OpnameSession
	formItems    map[string][]*domain.OpnameFormItem
	countEntries map[string][]*domain.OpnameCountEntry
	sessionItems map[string][]*domain.OpnameSessionItem
}

func newMockOpnameSessionRepo() *mockOpnameSessionRepo {
	return &mockOpnameSessionRepo{
		sessions:     make(map[string]*domain.OpnameSession),
		formItems:    make(map[string][]*domain.OpnameFormItem),
		countEntries: make(map[string][]*domain.OpnameCountEntry),
		sessionItems: make(map[string][]*domain.OpnameSessionItem),
	}
}

func (m *mockOpnameSessionRepo) Create(ctx context.Context, session *domain.OpnameSession) error {
	m.sessions[session.ID] = session
	return nil
}

func (m *mockOpnameSessionRepo) GetByID(ctx context.Context, id string) (*domain.OpnameSession, error) {
	s, ok := m.sessions[id]
	if !ok {
		return nil, errors.New("session not found")
	}
	return s, nil
}

func (m *mockOpnameSessionRepo) ListByOutlet(ctx context.Context, outletID string, statuses []string, limit, offset int) ([]*domain.OpnameSession, error) {
	var res []*domain.OpnameSession
	for _, s := range m.sessions {
		if s.OutletID != outletID {
			continue
		}
		if len(statuses) > 0 {
			match := false
			for _, st := range statuses {
				if s.Status == st {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		}
		res = append(res, s)
	}
	return res, nil
}

func (m *mockOpnameSessionRepo) SetFormItems(ctx context.Context, sessionID string, rawMaterialIDs []string) error {
	var items []*domain.OpnameFormItem
	for _, rmID := range rawMaterialIDs {
		items = append(items, &domain.OpnameFormItem{
			ID:            rmID + "_item",
			SessionID:     sessionID,
			RawMaterialID: rmID,
		})
	}
	m.formItems[sessionID] = items
	return nil
}

func (m *mockOpnameSessionRepo) ListFormItems(ctx context.Context, sessionID string) ([]*domain.OpnameFormItem, error) {
	return m.formItems[sessionID], nil
}

func (m *mockOpnameSessionRepo) UpsertCountEntries(ctx context.Context, entries []*domain.OpnameCountEntry) error {
	for _, entry := range entries {
		existing := m.countEntries[entry.SessionID]
		found := false
		for i, e := range existing {
			if e.RawMaterialID == entry.RawMaterialID && e.CountedBy == entry.CountedBy {
				existing[i].ActualStock = entry.ActualStock
				existing[i].ActualPackageQuantity = entry.ActualPackageQuantity
				existing[i].InputType = entry.InputType
				existing[i].Notes = entry.Notes
				found = true
				break
			}
		}
		if !found {
			m.countEntries[entry.SessionID] = append(m.countEntries[entry.SessionID], entry)
		}
	}
	return nil
}

func (m *mockOpnameSessionRepo) ListCountEntries(ctx context.Context, sessionID string) ([]*domain.OpnameCountEntry, error) {
	return m.countEntries[sessionID], nil
}

func (m *mockOpnameSessionRepo) ListCountEntriesByStaff(ctx context.Context, sessionID, staffID string) ([]*domain.OpnameCountEntry, error) {
	var res []*domain.OpnameCountEntry
	for _, e := range m.countEntries[sessionID] {
		if e.CountedBy == staffID {
			res = append(res, e)
		}
	}
	return res, nil
}

func (m *mockOpnameSessionRepo) HasCountEntries(ctx context.Context, sessionID string) (bool, error) {
	return len(m.countEntries[sessionID]) > 0, nil
}

func (m *mockOpnameSessionRepo) ListItems(ctx context.Context, sessionID string) ([]*domain.OpnameSessionItem, error) {
	return m.sessionItems[sessionID], nil
}

func (m *mockOpnameSessionRepo) Publish(ctx context.Context, sessionID string, publishedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusOpen {
		return errors.New("cannot publish")
	}
	s.Status = domain.SOStatusPublished
	s.PublishedAt = &publishedAt
	return nil
}

func (m *mockOpnameSessionRepo) MarkCounting(ctx context.Context, sessionID string) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusPublished {
		return errors.New("cannot mark counting")
	}
	s.Status = domain.SOStatusCounting
	return nil
}

func (m *mockOpnameSessionRepo) Close(ctx context.Context, sessionID string, closedAt time.Time, closedBy string) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusCounting {
		return errors.New("cannot close")
	}
	s.Status = domain.SOStatusClosed
	s.ClosedAt = &closedAt
	s.ClosedBy = &closedBy

	// Aggregate counts into sessionItems
	materialTotals := make(map[string]float64)
	for _, ce := range m.countEntries[sessionID] {
		materialTotals[ce.RawMaterialID] += ce.ActualStock
	}

	var items []*domain.OpnameSessionItem
	for rmID, totalActual := range materialTotals {
		sys := 100.0 // mock system stock
		diff := totalActual - sys
		diffVal := diff * 1000.0
		items = append(items, &domain.OpnameSessionItem{
			ID:              rmID + "_res",
			SessionID:       sessionID,
			RawMaterialID:   rmID,
			ActualStock:     totalActual,
			SystemStock:     &sys,
			Difference:      &diff,
			DifferenceValue: &diffVal,
		})
	}
	m.sessionItems[sessionID] = items
	return nil
}

func (m *mockOpnameSessionRepo) Approve(ctx context.Context, sessionID string, approvedBy string, approvedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusClosed {
		return errors.New("cannot approve")
	}
	s.Status = domain.SOStatusApproved
	s.ApprovedBy = &approvedBy
	s.ApprovedAt = &approvedAt
	return nil
}

func (m *mockOpnameSessionRepo) Reject(ctx context.Context, sessionID string, rejectedBy string, rejectedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusClosed {
		return errors.New("cannot reject")
	}
	s.Status = domain.SOStatusRejected
	s.ApprovedBy = &rejectedBy
	s.ApprovedAt = &rejectedAt
	return nil
}

func (m *mockOpnameSessionRepo) GetRecountChain(ctx context.Context, sessionID string) ([]*domain.OpnameSession, error) {
	var chain []*domain.OpnameSession
	curr := m.sessions[sessionID]
	for curr != nil {
		chain = append([]*domain.OpnameSession{curr}, chain...)
		if curr.RecountOf == nil {
			break
		}
		curr = m.sessions[*curr.RecountOf]
	}
	return chain, nil
}

func TestOpnameSessionService(t *testing.T) {
	ctx := context.Background()

	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Outlet 1"},
		},
	}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "o1", Name: "Kopi", Stock: 100, CostPerUnit: 1000},
			{ID: "rm2", OutletID: "o1", Name: "Gula", Stock: 100, CostPerUnit: 500},
		},
	}

	repo := newMockOpnameSessionRepo()
	txManager := database.NewMockTransactionManager()
	svc := service.NewOpnameSessionService(repo, rmRepo, outletRepo, txManager)

	var formID string

	t.Run("Create Form - Success", func(t *testing.T) {
		res, err := svc.CreateForm(ctx, "b1", "o1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			Notes:          "Opname bulanan",
			RawMaterialIDs: []string{"rm1", "rm2"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Status != domain.SOStatusOpen {
			t.Errorf("expected status OPEN, got %s", res.Status)
		}
		if len(res.Materials) != 2 {
			t.Errorf("expected 2 materials, got %d", len(res.Materials))
		}
		formID = res.ID
	})

	t.Run("Create Form - Invalid Outlet", func(t *testing.T) {
		_, err := svc.CreateForm(ctx, "b_wrong", "o1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			RawMaterialIDs: []string{"rm1"},
		})
		if err == nil {
			t.Error("expected error for wrong business, got nil")
		}
	})

	t.Run("Create Form - Invalid Material", func(t *testing.T) {
		_, err := svc.CreateForm(ctx, "b1", "o1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			RawMaterialIDs: []string{"rm_nonexistent"},
		})
		if err == nil {
			t.Error("expected error for non-existent material, got nil")
		}
	})

	t.Run("Update Form Items - Allowed in OPEN", func(t *testing.T) {
		res, err := svc.UpdateFormItems(ctx, "b1", "o1", formID, []string{"rm1"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(res.Materials) != 1 {
			t.Errorf("expected 1 material, got %d", len(res.Materials))
		}
		// Reset back to 2 materials
		svc.UpdateFormItems(ctx, "b1", "o1", formID, []string{"rm1", "rm2"})
	})

	t.Run("Publish Form - Success", func(t *testing.T) {
		err := svc.PublishForm(ctx, "b1", "o1", formID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		detail, _ := svc.GetFormForCounting(ctx, "b1", "o1", formID)
		if detail.Status != domain.SOStatusPublished {
			t.Errorf("expected status PUBLISHED, got %s", detail.Status)
		}
	})

	t.Run("Update Form Items - Rejected after PUBLISHED", func(t *testing.T) {
		_, err := svc.UpdateFormItems(ctx, "b1", "o1", formID, []string{"rm1"})
		if !errors.Is(err, service.ErrSOFormNotOpen) {
			t.Errorf("expected ErrSOFormNotOpen, got %v", err)
		}
	})

	t.Run("Submit Counts - Multi-cashier with status transition to COUNTING", func(t *testing.T) {
		// Kasir 1 hitung
		err := svc.SubmitCounts(ctx, "b1", "o1", formID, "staff_kasir1", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 40, InputType: "base_unit"},
			{RawMaterialID: "rm2", ActualStock: 50, InputType: "base_unit"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Verify form transitioned to COUNTING
		detail, _ := svc.GetFormForCounting(ctx, "b1", "o1", formID)
		if detail.Status != domain.SOStatusCounting {
			t.Errorf("expected status COUNTING, got %s", detail.Status)
		}

		// Kasir 2 hitung partial (hanya rm1)
		err = svc.SubmitCounts(ctx, "b1", "o1", formID, "staff_kasir2", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 55, InputType: "base_unit"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Kasir 1 inspect my counts
		myCounts, err := svc.GetMyCounts(ctx, "b1", "o1", formID, "staff_kasir1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(myCounts.Items) != 2 {
			t.Errorf("expected 2 items for staff 1, got %d", len(myCounts.Items))
		}
	})

	t.Run("Close Form - Success", func(t *testing.T) {
		closedRes, err := svc.CloseForm(ctx, "b1", "o1", formID, "admin1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if closedRes.Status != domain.SOStatusClosed {
			t.Errorf("expected status CLOSED, got %s", closedRes.Status)
		}
		if len(closedRes.CountSheets) != 2 {
			t.Errorf("expected 2 count sheets (kasir1 & kasir2), got %d", len(closedRes.CountSheets))
		}

		// Check aggregated sum for rm1: 40 + 55 = 95
		var rm1Final *domain.SOFinalSheetItem
		for _, it := range closedRes.FinalSheet.Items {
			if it.RawMaterialID == "rm1" {
				rm1Final = it
				break
			}
		}
		if rm1Final == nil {
			t.Fatal("expected rm1 in final sheet")
		}
		if rm1Final.ActualStock != 95 {
			t.Errorf("expected actual stock 95 (40+55), got %f", rm1Final.ActualStock)
		}
	})

	t.Run("Recount Form - Creates new form linked to parent", func(t *testing.T) {
		recountRes, err := svc.RecountForm(ctx, "b1", "o1", formID, "admin1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if recountRes.Status != domain.SOStatusOpen {
			t.Errorf("expected new form to be OPEN, got %s", recountRes.Status)
		}
		if recountRes.RecountOf == nil || *recountRes.RecountOf != formID {
			t.Errorf("expected recount_of = %s, got %v", formID, recountRes.RecountOf)
		}
		if recountRes.RecountNumber != 1 {
			t.Errorf("expected recount_number = 1, got %d", recountRes.RecountNumber)
		}
		if len(recountRes.Materials) != 2 {
			t.Errorf("expected 2 materials copied from parent, got %d", len(recountRes.Materials))
		}
	})

	t.Run("Approve Form - Adjusts Stock based on difference", func(t *testing.T) {
		res, err := svc.ApproveForm(ctx, "b1", "o1", formID, "admin1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Status != domain.SOStatusApproved {
			t.Errorf("expected status APPROVED, got %s", res.Status)
		}

		// System stock was 100, actual was 95 (diff = -5)
		// adjusted = 100 + (-5) = 95
		rm1, _ := rmRepo.GetByID(ctx, "rm1")
		if rm1.Stock != 95 {
			t.Errorf("expected stock adjusted to 95, got %f", rm1.Stock)
		}
	})

	t.Run("Recount Form - Rejected if already APPROVED", func(t *testing.T) {
		_, err := svc.RecountForm(ctx, "b1", "o1", formID, "admin1")
		if err == nil {
			t.Error("expected error recounting approved form, got nil")
		}
	})

	t.Run("Submit Counts - Staff Validation", func(t *testing.T) {
		staffRepo := &MockStaffRepository{
			staffs: []*domain.Staff{
				{ID: "staff-valid", OutletID: "o1", Name: "Siti Kasir", IsActive: true},
				{ID: "staff-inactive", OutletID: "o1", Name: "Budi Nonaktif", IsActive: false},
				{ID: "staff-other-outlet", OutletID: "o2", Name: "Joko Cabang Lain", IsActive: true},
			},
		}

		svcWithStaff := service.NewOpnameSessionService(
			repo, rmRepo, outletRepo, txManager,
			service.WithSOStaffRepository(staffRepo),
		)

		// Create and publish a form for testing
		formRes, err := svcWithStaff.CreateForm(ctx, "b1", "o1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			RawMaterialIDs: []string{"rm1"},
		})
		if err != nil {
			t.Fatalf("unexpected error creating form: %v", err)
		}
		if err := svcWithStaff.PublishForm(ctx, "b1", "o1", formRes.ID); err != nil {
			t.Fatalf("unexpected error publishing form: %v", err)
		}

		// 1. Staff does not exist
		err = svcWithStaff.SubmitCounts(ctx, "b1", "o1", formRes.ID, "staff-ghost", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 10, InputType: "base_unit"},
		})
		if !errors.Is(err, service.ErrSOStaffNotFound) {
			t.Errorf("expected ErrSOStaffNotFound, got %v", err)
		}

		// 2. Staff from other outlet
		err = svcWithStaff.SubmitCounts(ctx, "b1", "o1", formRes.ID, "staff-other-outlet", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 10, InputType: "base_unit"},
		})
		if !errors.Is(err, service.ErrSOStaffForbidden) {
			t.Errorf("expected ErrSOStaffForbidden, got %v", err)
		}

		// 3. Inactive staff
		err = svcWithStaff.SubmitCounts(ctx, "b1", "o1", formRes.ID, "staff-inactive", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 10, InputType: "base_unit"},
		})
		if !errors.Is(err, service.ErrSOStaffInactive) {
			t.Errorf("expected ErrSOStaffInactive, got %v", err)
		}

		// 4. Valid staff
		err = svcWithStaff.SubmitCounts(ctx, "b1", "o1", formRes.ID, "staff-valid", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualStock: 10, InputType: "base_unit"},
		})
		if err != nil {
			t.Errorf("unexpected error with valid staff: %v", err)
		}

		// 5. GetMyCounts with valid staff returns staff name
		myCounts, err := svcWithStaff.GetMyCounts(ctx, "b1", "o1", formRes.ID, "staff-valid")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if myCounts.StaffName != "Siti Kasir" {
			t.Errorf("expected StaffName 'Siti Kasir', got %s", myCounts.StaffName)
		}
	})
}


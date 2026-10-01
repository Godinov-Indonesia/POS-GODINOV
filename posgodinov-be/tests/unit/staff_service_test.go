package unit

import (
	"context"
	"errors"
	"testing"
	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockStaffRepository struct {
	staffs         []*domain.Staff
	hasActiveShift map[string]bool
}


func (m *MockStaffRepository) Create(ctx context.Context, staff *domain.Staff) error {
	m.staffs = append(m.staffs, staff)
	return nil
}

func (m *MockStaffRepository) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) {
	for _, s := range m.staffs {
		if s.OutletID == outletID && s.StaffIdentifier == staffIdentifier {
			return s, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockStaffRepository) GetByID(ctx context.Context, id string) (*domain.Staff, error) {
	for _, s := range m.staffs {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, errors.New("not found")
}
func (m *MockStaffRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	return nil, nil
}

func (m *MockStaffRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepository) Update(ctx context.Context, staff *domain.Staff) error {
	for i, s := range m.staffs {
		if s.ID == staff.ID {
			m.staffs[i] = staff
			return nil
		}
	}
	return errors.New("not found")
}
func (m *MockStaffRepository) Delete(ctx context.Context, id string) error {
	return nil
}

func (m *MockStaffRepository) HasActiveShift(ctx context.Context, staffID string) (bool, error) {
	if m.hasActiveShift != nil && m.hasActiveShift[staffID] {
		return true, nil
	}
	return false, nil
}


func TestRegisterStaff(t *testing.T) {
	ctx := context.Background()

	staffRepo := &MockStaffRepository{
		staffs: []*domain.Staff{
			{OutletID: "o1", StaffIdentifier: "kasir1"},
		},
	}
	
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
			{ID: "o2", BusinessID: "b2"}, // belong to other business
		},
	}

	svc := service.NewStaffService(staffRepo, outletRepo)

	t.Run("Valid Registration", func(t *testing.T) {
		req := &domain.CreateStaffRequest{
			OutletID:        "o1",
			StaffIdentifier: "kasir2",
			Name:            "Kasir Dua",
			PIN:             "123456",
		}
		
		res, err := svc.RegisterStaff(ctx, "b1", req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Name != "Kasir Dua" {
			t.Errorf("expected name Kasir Dua, got %s", res.Name)
		}
		
		errBcrypt := bcrypt.CompareHashAndPassword([]byte(res.PINHash), []byte("123456"))
		if errBcrypt != nil {
			t.Errorf("expected correct PIN hash, got error %v", errBcrypt)
		}
	})

	t.Run("Outlet Not Belong To Business", func(t *testing.T) {
		req := &domain.CreateStaffRequest{
			OutletID:        "o2",
			StaffIdentifier: "kasir3",
			Name:            "Kasir Tiga",
			PIN:             "1234",
		}
		_, err := svc.RegisterStaff(ctx, "b1", req)
		if err == nil {
			t.Error("expected error for wrong business id, got nil")
		}
	})
	
	t.Run("Duplicate Staff Identifier in same Outlet", func(t *testing.T) {
		req := &domain.CreateStaffRequest{
			OutletID:        "o1",
			StaffIdentifier: "kasir1", // already exists
			Name:            "Kasir Satu",
			PIN:             "1234",
		}
		_, err := svc.RegisterStaff(ctx, "b1", req)
		if err == nil {
			t.Error("expected error for duplicate staff identifier, got nil")
		}
	})
}

func TestUpdateStaffRoleAndPermissions(t *testing.T) {
	ctx := context.Background()

	staffRepo := &MockStaffRepository{
		staffs: []*domain.Staff{
			{ID: "s1", OutletID: "o1", StaffIdentifier: "staf1", Name: "Staf Satu", Role: domain.RoleCashier, Permissions: domain.StringList{}},
		},
	}
	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1"},
		},
	}
	svc := service.NewStaffService(staffRepo, outletRepo)

	t.Run("Valid Role and Permissions Update", func(t *testing.T) {
		newRole := domain.RoleSupervisor
		newPerms := domain.StringList{domain.PermissionVoidApprove, domain.PermissionOpnameCount}
		req := &domain.UpdateStaffRequest{
			Role:        &newRole,
			Permissions: &newPerms,
		}

		updated, err := svc.UpdateStaff(ctx, "b1", "s1", req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.Role != domain.RoleSupervisor {
			t.Errorf("expected role SUPERVISOR, got %s", updated.Role)
		}
		if len(updated.Permissions) != 2 || !updated.Permissions.Has(domain.PermissionOpnameCount) {
			t.Errorf("expected permissions to contain OPNAME_COUNT, got %v", updated.Permissions)
		}
	})

	t.Run("Invalid Role Update", func(t *testing.T) {
		invalidRole := domain.StaffRole("HACKER")
		req := &domain.UpdateStaffRequest{
			Role: &invalidRole,
		}
		_, err := svc.UpdateStaff(ctx, "b1", "s1", req)
		if err == nil {
			t.Error("expected error for invalid role, got nil")
		}
	})

	t.Run("Invalid Permission Update", func(t *testing.T) {
		invalidPerms := domain.StringList{"DO_ANYTHING"}
		req := &domain.UpdateStaffRequest{
			Permissions: &invalidPerms,
		}
		_, err := svc.UpdateStaff(ctx, "b1", "s1", req)
		if err == nil {
			t.Error("expected error for invalid permission, got nil")
		}
	})
}

func TestTransferStaff(t *testing.T) {
	ctx := context.Background()

	setup := func() (domain.StaffService, *MockStaffRepository) {
		staffRepo := &MockStaffRepository{
			staffs: []*domain.Staff{
				{
					ID:              "staff-1",
					OutletID:        "outlet-A",
					StaffIdentifier: "101",
					Name:            "Budi Staff",
					Role:            domain.RoleCashier,
					IsActive:        true,
				},
				{
					ID:              "staff-2",
					OutletID:        "outlet-B",
					StaffIdentifier: "102",
					Name:            "Ani Staff",
					Role:            domain.RoleCashier,
					IsActive:        true,
				},
			},
			hasActiveShift: make(map[string]bool),
		}
		outletRepo := &MockOutletRepository{
			outlets: []*domain.Outlet{
				{ID: "outlet-A", BusinessID: "biz-1", Name: "Outlet A"},
				{ID: "outlet-B", BusinessID: "biz-1", Name: "Outlet B"},
				{ID: "outlet-C", BusinessID: "biz-2", Name: "Outlet C (Lain)"},
			},
		}
		svc := service.NewStaffService(staffRepo, outletRepo)
		return svc, staffRepo
	}

	t.Run("Success Transfer - Same Identifier", func(t *testing.T) {
		svc, staffRepo := setup()
		req := &domain.TransferStaffRequest{
			TargetOutletID: "outlet-B",
		}
		transferred, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if transferred.OutletID != "outlet-B" {
			t.Errorf("expected outlet-B, got %s", transferred.OutletID)
		}
		if transferred.StaffIdentifier != "101" {
			t.Errorf("expected identifier 101, got %s", transferred.StaffIdentifier)
		}
		// Check in repo
		st, _ := staffRepo.GetByID(ctx, "staff-1")
		if st.OutletID != "outlet-B" {
			t.Errorf("expected repo to reflect outlet-B, got %s", st.OutletID)
		}
	})

	t.Run("Success Transfer - New Identifier", func(t *testing.T) {
		svc, _ := setup()
		newId := "999"
		req := &domain.TransferStaffRequest{
			TargetOutletID:  "outlet-B",
			StaffIdentifier: &newId,
		}
		transferred, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if transferred.OutletID != "outlet-B" {
			t.Errorf("expected outlet-B, got %s", transferred.OutletID)
		}
		if transferred.StaffIdentifier != "999" {
			t.Errorf("expected identifier 999, got %s", transferred.StaffIdentifier)
		}
	})

	t.Run("Fail - Target Same Outlet", func(t *testing.T) {
		svc, _ := setup()
		req := &domain.TransferStaffRequest{
			TargetOutletID: "outlet-A",
		}
		_, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err == nil {
			t.Error("expected error for same outlet transfer, got nil")
		}
	})

	t.Run("Fail - Target Other Business", func(t *testing.T) {
		svc, _ := setup()
		req := &domain.TransferStaffRequest{
			TargetOutletID: "outlet-C",
		}
		_, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err == nil {
			t.Error("expected error for other business outlet, got nil")
		}
	})

	t.Run("Fail - Target Not Found", func(t *testing.T) {
		svc, _ := setup()
		req := &domain.TransferStaffRequest{
			TargetOutletID: "non-existent",
		}
		_, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err == nil {
			t.Error("expected error for non-existent outlet, got nil")
		}
	})

	t.Run("Fail - Has Active Shift", func(t *testing.T) {
		svc, staffRepo := setup()
		staffRepo.hasActiveShift["staff-1"] = true
		req := &domain.TransferStaffRequest{
			TargetOutletID: "outlet-B",
		}
		_, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err == nil {
			t.Error("expected error when staff has active shift, got nil")
		}
	})

	t.Run("Fail - Identifier Collision in Target Outlet", func(t *testing.T) {
		svc, _ := setup()
		collisionId := "102" // staff-2 already has 102 in outlet-B
		req := &domain.TransferStaffRequest{
			TargetOutletID:  "outlet-B",
			StaffIdentifier: &collisionId,
		}
		_, err := svc.TransferStaff(ctx, "biz-1", "staff-1", req)
		if err == nil {
			t.Error("expected error for identifier collision, got nil")
		}
	})
}


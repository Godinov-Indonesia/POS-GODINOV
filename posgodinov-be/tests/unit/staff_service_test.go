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
	staffs []*domain.Staff
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
	return nil, errors.New("not found")
}
func (m *MockStaffRepository) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	return nil, nil
}

func (m *MockStaffRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepository) Update(ctx context.Context, staff *domain.Staff) error {
	return nil
}
func (m *MockStaffRepository) Delete(ctx context.Context, id string) error {
	return nil
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

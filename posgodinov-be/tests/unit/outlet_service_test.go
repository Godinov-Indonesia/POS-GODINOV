package unit

import (
	"context"
	"testing"
	"errors"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/database"
)

type MockOutletRepository struct {
	outlets []*domain.Outlet
}

func (m *MockOutletRepository) Create(ctx context.Context, outlet *domain.Outlet) error {
	m.outlets = append(m.outlets, outlet)
	return nil
}

func (m *MockOutletRepository) CountByBusinessID(ctx context.Context, businessID string) (int64, error) {
	count := int64(0)
	for _, o := range m.outlets {
		if o.BusinessID == businessID {
			count++
		}
	}
	return count, nil
}

func (m *MockOutletRepository) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Outlet, error) {
	var result []*domain.Outlet
	for _, o := range m.outlets {
		if o.BusinessID == businessID {
			result = append(result, o)
		}
	}
	return result, nil
}

func (m *MockOutletRepository) GetByID(ctx context.Context, id string) (*domain.Outlet, error) {
	for _, o := range m.outlets {
		if o.ID == id {
			return o, nil
		}
	}
	return nil, errors.New("outlet not found")
}

func (m *MockOutletRepository) GetBySerialOutlet(ctx context.Context, businessID string, serial string) (*domain.Outlet, error) {
	return nil, nil
}

func TestRegisterOutlet(t *testing.T) {
	ctx := context.Background()

	outletRepo := &MockOutletRepository{}
	businessRepo := &MockBusinessRepository{
		businesses: []*domain.Business{
			{
				ID:             "b1",
				SerialBusiness: "POSXX180726",
			},
		},
	}
	
	txManager := database.NewMockTransactionManager()
	svc := service.NewOutletService(outletRepo, businessRepo, txManager)

	// Valid Registration
	req := &domain.CreateOutletRequest{
		Name:    "Cabang Jakarta",
		Address: "Jl. Sudirman",
	}

	outlet, err := svc.Register(ctx, "b1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if outlet.BusinessID != "b1" {
		t.Errorf("expected business ID to be b1, got %s", outlet.BusinessID)
	}

	if outlet.SerialOutlet != "POSXX180726001" {
		t.Errorf("expected serial tenant POSXX180726001, got %s", outlet.SerialOutlet)
	}

	// Invalid Business ID
	_, err = svc.Register(ctx, "wrong-id", req)
	if err == nil {
		t.Error("expected error due to invalid business ID")
	}

	// Empty Name
	_, err = svc.Register(ctx, "b1", &domain.CreateOutletRequest{
		Name:    "",
		Address: "Jl. Sudirman",
	})
	if err == nil {
		t.Error("expected error due to empty name")
	}
}

func TestGetAllOutlets(t *testing.T) {
	ctx := context.Background()

	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "o1", BusinessID: "b1", Name: "Outlet 1"},
			{ID: "o2", BusinessID: "b1", Name: "Outlet 2"},
			{ID: "o3", BusinessID: "b2", Name: "Outlet 3"},
		},
	}
	businessRepo := &MockBusinessRepository{}
	txManager := database.NewMockTransactionManager()
	
	svc := service.NewOutletService(outletRepo, businessRepo, txManager)

	// Get outlets for b1
	outlets, err := svc.GetAll(ctx, "b1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(outlets) != 2 {
		t.Errorf("expected 2 outlets, got %d", len(outlets))
	}

	// Empty business ID
	_, err = svc.GetAll(ctx, "")
	if err == nil {
		t.Error("expected error for empty business ID")
	}
}

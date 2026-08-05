package unit

import (
	"context"
	"errors"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockBusinessRepositoryForAuth struct {
	businesses []*domain.Business
}

func (m *MockBusinessRepositoryForAuth) Create(ctx context.Context, b *domain.Business) error { return nil }
func (m *MockBusinessRepositoryForAuth) GetByEmail(ctx context.Context, email string) (*domain.Business, error) { return nil, nil }
func (m *MockBusinessRepositoryForAuth) GetByID(ctx context.Context, id string) (*domain.Business, error) { return nil, nil }
func (m *MockBusinessRepositoryForAuth) LockByID(ctx context.Context, id string) (*domain.Business, error) { return nil, nil }

func (m *MockBusinessRepositoryForAuth) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.SerialBusiness == serial {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

type MockOutletRepositoryForAuth struct {
	outlets []*domain.Outlet
}

func (m *MockOutletRepositoryForAuth) Create(ctx context.Context, o *domain.Outlet) error { return nil }
func (m *MockOutletRepositoryForAuth) CountByBusinessID(ctx context.Context, businessID string) (int64, error) { return 0, nil }
func (m *MockOutletRepositoryForAuth) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Outlet, error) { return nil, nil }
func (m *MockOutletRepositoryForAuth) GetByID(ctx context.Context, id string) (*domain.Outlet, error) { return nil, nil }

func (m *MockOutletRepositoryForAuth) GetBySerialTenant(ctx context.Context, businessID, serial string) (*domain.Outlet, error) {
	for _, o := range m.outlets {
		if o.BusinessID == businessID && o.SerialTenant == serial {
			return o, nil
		}
	}
	return nil, errors.New("outlet not found")
}

func TestBindDevice(t *testing.T) {
	ctx := context.Background()

	mockBusinessRepo := &MockBusinessRepositoryForAuth{}
	mockOutletRepo := &MockOutletRepositoryForAuth{}
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")

	svc := service.NewPOSAuthService(mockBusinessRepo, mockOutletRepo, tokenMaker)

	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	mockBusinessRepo.businesses = append(mockBusinessRepo.businesses, &domain.Business{
		ID:             "biz-1",
		SerialBusiness: "BIZ-001",
		Password:       string(hashedPass),
	})

	mockOutletRepo.outlets = append(mockOutletRepo.outlets, &domain.Outlet{
		ID:           "out-1",
		BusinessID:   "biz-1",
		SerialTenant: "OUT-001",
	})

	// 1. Success case
	req := &domain.DeviceBindRequest{
		SerialBusiness: "BIZ-001",
		SerialOutlet:   "OUT-001",
		Password:       "password123",
	}

	res, err := svc.BindDevice(ctx, req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.DeviceToken == "" {
		t.Error("expected valid device token")
	}

	// 2. Invalid Business Serial
	reqInvalidBiz := &domain.DeviceBindRequest{
		SerialBusiness: "BIZ-002",
		SerialOutlet:   "OUT-001",
		Password:       "password123",
	}
	_, err = svc.BindDevice(ctx, reqInvalidBiz)
	if err == nil {
		t.Error("expected error for invalid business serial")
	}

	// 3. Invalid Password
	reqInvalidPass := &domain.DeviceBindRequest{
		SerialBusiness: "BIZ-001",
		SerialOutlet:   "OUT-001",
		Password:       "wrongpass",
	}
	_, err = svc.BindDevice(ctx, reqInvalidPass)
	if err == nil {
		t.Error("expected error for invalid password")
	}

	// 4. Invalid Outlet Serial
	reqInvalidOut := &domain.DeviceBindRequest{
		SerialBusiness: "BIZ-001",
		SerialOutlet:   "OUT-002",
		Password:       "password123",
	}
	_, err = svc.BindDevice(ctx, reqInvalidOut)
	if err == nil {
		t.Error("expected error for invalid outlet serial")
	}
}

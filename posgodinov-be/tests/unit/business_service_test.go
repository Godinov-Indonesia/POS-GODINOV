package unit

import (
	"context"
	"errors"
	"testing"
	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/pkg/token"
)

// MockBusinessRepository manual mock
type MockBusinessRepository struct {
	businesses []*domain.Business
}

func (m *MockBusinessRepository) Create(ctx context.Context, b *domain.Business) error {
	m.businesses = append(m.businesses, b)
	return nil
}

func (m *MockBusinessRepository) GetByEmail(ctx context.Context, email string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.Email == email {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

func (m *MockBusinessRepository) GetByID(ctx context.Context, id string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.ID == id {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

func (m *MockBusinessRepository) LockByID(ctx context.Context, id string) (*domain.Business, error) {
	return m.GetByID(ctx, id)
}

func (m *MockBusinessRepository) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	return nil, nil
}

func TestRegisterBusiness(t *testing.T) {
	ctx := t.Context()

	mockRepo := &MockBusinessRepository{}
	
	// Gunakan kunci rahasia acak 32 bytes untuk Paseto
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()

	svc := service.NewBusinessService(mockRepo, tokenMaker, txManager, nil)

	req := &domain.RegisterBusinessRequest{
		Name:                 "Warteg Bahari",
		OwnerName:            "Budi",
		Email:                "budi@warteg.com",
		Password:             "secret123",
		ConfirmationPassword: "secret123",
	}

	res, err := svc.Register(ctx, req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if res.Business == nil {
		t.Fatal("expected business not to be nil")
	}

	if res.Business.Email != "budi@warteg.com" {
		t.Errorf("expected email budi@warteg.com, got %s", res.Business.Email)
	}

	if res.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if res.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
	
	// Test if password mismatch works
	reqMismatch := &domain.RegisterBusinessRequest{
		Password: "abc",
		ConfirmationPassword: "def",
	}
	_, errMismatch := svc.Register(ctx, reqMismatch)
	if errMismatch == nil {
		t.Error("expected error due to password mismatch, got nil")
	}
	
	// Test rollback (mocking DB error)
	// Kita bisa mensimulasikan error pada DB dengan membuat implementasi mock yang khusus, 
	// namun cukup memastikan bahwa service meng-handle err dari Transaction.
}

func TestLoginBusiness(t *testing.T) {
	ctx := t.Context()

	mockRepo := &MockBusinessRepository{}
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()
	svc := service.NewBusinessService(mockRepo, tokenMaker, txManager, nil)

	// Setup a user
	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	mockRepo.businesses = append(mockRepo.businesses, &domain.Business{
		ID:       "id-123",
		Email:    "test@domain.com",
		Password: string(hashedPass),
	})

	// Correct login
	res, err := svc.Login(ctx, &domain.LoginBusinessRequest{
		Email:    "test@domain.com",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.AccessToken == "" {
		t.Error("expected access token")
	}
	if res.RefreshToken == "" {
		t.Error("expected refresh token")
	}

	// Wrong password
	_, err = svc.Login(ctx, &domain.LoginBusinessRequest{
		Email:    "test@domain.com",
		Password: "wrong",
	})
	if err == nil {
		t.Error("expected error for wrong password")
	}

	// Wrong email
	_, err = svc.Login(ctx, &domain.LoginBusinessRequest{
		Email:    "wrong@domain.com",
		Password: "password123",
	})
	if err == nil {
		t.Error("expected error for wrong email")
	}
}

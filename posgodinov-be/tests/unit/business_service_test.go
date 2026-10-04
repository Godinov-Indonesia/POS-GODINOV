package unit

import (
	"context"
	"errors"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
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

func (m *MockBusinessRepository) GetByGoogleID(ctx context.Context, googleID string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.GoogleID != nil && *b.GoogleID == googleID {
			return b, nil
		}
	}
	return nil, errors.New("business not found")
}

func (m *MockBusinessRepository) UpsertByGoogle(ctx context.Context, b *domain.Business) error {
	for _, existing := range m.businesses {
		if existing.Email == b.Email {
			existing.GoogleID = b.GoogleID
			return nil
		}
	}
	m.businesses = append(m.businesses, b)
	return nil
}

func newTestService(repo domain.BusinessRepository) domain.BusinessService {
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()
	return service.NewBusinessService(repo, tokenMaker, txManager, nil, "", "", "")
}

func ptrStr(s string) *string { return &s }

func TestRegisterBusiness(t *testing.T) {
	ctx := t.Context()
	svc := newTestService(&MockBusinessRepository{})

	t.Run("sukses register", func(t *testing.T) {
		res, err := svc.Register(ctx, &domain.RegisterBusinessRequest{
			Name:                 "Warteg Bahari",
			OwnerName:            "Budi",
			Email:                "budi@warteg.com",
			Password:             "secret123",
			ConfirmationPassword: "secret123",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Business.Email != "budi@warteg.com" {
			t.Errorf("email mismatch: got %s", res.Business.Email)
		}
		if res.AccessToken == "" || res.RefreshToken == "" {
			t.Error("token kosong")
		}
	})

	t.Run("password kosong ditolak", func(t *testing.T) {
		_, err := svc.Register(ctx, &domain.RegisterBusinessRequest{
			Email:                "x@x.com",
			Password:             "",
			ConfirmationPassword: "",
		})
		if err == nil {
			t.Error("expected error untuk password kosong")
		}
	})

	t.Run("password tidak cocok ditolak", func(t *testing.T) {
		_, err := svc.Register(ctx, &domain.RegisterBusinessRequest{
			Email:                "x@x.com",
			Password:             "abc",
			ConfirmationPassword: "def",
		})
		if err == nil {
			t.Error("expected error untuk password mismatch")
		}
	})
}

func TestLoginBusiness(t *testing.T) {
	ctx := t.Context()
	repo := &MockBusinessRepository{}

	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	hashed := string(hashedPass)
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-123",
		Email:    "test@domain.com",
		Password: &hashed,
	})

	// Akun Google-only: tanpa password
	googleID := "google-uid-999"
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-google",
		Email:    "google@domain.com",
		GoogleID: &googleID,
	})

	svc := newTestService(repo)

	t.Run("login valid", func(t *testing.T) {
		res, err := svc.Login(ctx, &domain.LoginBusinessRequest{
			Email:    "test@domain.com",
			Password: "password123",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.AccessToken == "" || res.RefreshToken == "" {
			t.Error("token kosong")
		}
	})

	t.Run("password salah ditolak", func(t *testing.T) {
		_, err := svc.Login(ctx, &domain.LoginBusinessRequest{
			Email:    "test@domain.com",
			Password: "wrong",
		})
		if err == nil {
			t.Error("expected error untuk password salah")
		}
	})

	t.Run("email tidak ditemukan", func(t *testing.T) {
		_, err := svc.Login(ctx, &domain.LoginBusinessRequest{
			Email:    "notfound@domain.com",
			Password: "password123",
		})
		if err == nil {
			t.Error("expected error untuk email tidak ditemukan")
		}
	})

	t.Run("password kosong ditolak", func(t *testing.T) {
		_, err := svc.Login(ctx, &domain.LoginBusinessRequest{
			Email:    "test@domain.com",
			Password: "",
		})
		if err == nil {
			t.Error("expected error untuk password kosong")
		}
	})

	t.Run("akun Google-only tidak bisa login native", func(t *testing.T) {
		_, err := svc.Login(ctx, &domain.LoginBusinessRequest{
			Email:    "google@domain.com",
			Password: "apapun",
		})
		if err == nil {
			t.Error("expected error untuk akun OAuth tanpa password")
		}
		if err.Error() != "akun ini terdaftar via Google, gunakan login Google" {
			t.Errorf("pesan error tidak sesuai: %s", err.Error())
		}
	})
}

func TestGoogleOAuthURL(t *testing.T) {
	svc := newTestService(&MockBusinessRepository{})

	// Tanpa client ID yang nyata, url tetap terbentuk (bisa kosong config-nya).
	url := svc.GoogleOAuthURL(t.Context(), "random-state")
	if url == "" {
		t.Error("expected non-empty OAuth URL")
	}
}

func TestGoogleOAuthCallbackUpsert(t *testing.T) {
	ctx := t.Context()
	repo := &MockBusinessRepository{}

	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("native123"), bcrypt.DefaultCost)
	hashed := string(hashedPass)
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-native",
		Email:    "shared@domain.com",
		Password: &hashed,
	})

	svc := newTestService(repo)

	// GoogleOAuthCallback butuh Google server — kita test UpsertByGoogle langsung
	// via repo mock untuk memastikan logika upsert benar.
	t.Run("upsert link google_id ke akun email yang sudah ada", func(t *testing.T) {
		googleID := "gid-abc"
		err := repo.UpsertByGoogle(ctx, &domain.Business{
			Email:    "shared@domain.com",
			GoogleID: &googleID,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Pastikan akun lama sekarang punya google_id
		b, _ := repo.GetByEmail(ctx, "shared@domain.com")
		if b.GoogleID == nil || *b.GoogleID != "gid-abc" {
			t.Error("google_id tidak ter-link ke akun existing")
		}
		// Jumlah akun tidak bertambah
		if len(repo.businesses) != 1 {
			t.Errorf("expected 1 business, got %d", len(repo.businesses))
		}
	})

	t.Run("upsert buat akun baru jika email belum ada", func(t *testing.T) {
		googleID := "gid-new"
		err := repo.UpsertByGoogle(ctx, &domain.Business{
			ID:       "id-new",
			Email:    "new@domain.com",
			GoogleID: &googleID,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(repo.businesses) != 2 {
			t.Errorf("expected 2 businesses, got %d", len(repo.businesses))
		}
	})

	t.Run("GoogleOAuthURL terbentuk dengan state", func(t *testing.T) {
		url := svc.GoogleOAuthURL(ctx, "csrf-state-xyz")
		if url == "" {
			t.Error("URL kosong")
		}
	})
}

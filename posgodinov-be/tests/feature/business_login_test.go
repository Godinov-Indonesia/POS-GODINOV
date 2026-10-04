package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

// MockBusinessLoginRepository — mock untuk feature test login
type MockBusinessLoginRepository struct {
	businesses []*domain.Business
}

func (m *MockBusinessLoginRepository) Create(ctx context.Context, b *domain.Business) error {
	m.businesses = append(m.businesses, b)
	return nil
}

func (m *MockBusinessLoginRepository) GetByEmail(ctx context.Context, email string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.Email == email {
			return b, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockBusinessLoginRepository) GetByID(ctx context.Context, id string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.ID == id {
			return b, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockBusinessLoginRepository) LockByID(ctx context.Context, id string) (*domain.Business, error) {
	return m.GetByID(ctx, id)
}

func (m *MockBusinessLoginRepository) GetBySerialBusiness(ctx context.Context, serial string) (*domain.Business, error) {
	return nil, nil
}

func (m *MockBusinessLoginRepository) GetByGoogleID(ctx context.Context, googleID string) (*domain.Business, error) {
	for _, b := range m.businesses {
		if b.GoogleID != nil && *b.GoogleID == googleID {
			return b, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *MockBusinessLoginRepository) UpsertByGoogle(ctx context.Context, b *domain.Business) error {
	for _, existing := range m.businesses {
		if existing.Email == b.Email {
			existing.GoogleID = b.GoogleID
			return nil
		}
	}
	m.businesses = append(m.businesses, b)
	return nil
}

func newLoginTestSvc(repo domain.BusinessRepository) (domain.BusinessService, *handler.BusinessHandler, *http.ServeMux) {
	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")
	txManager := database.NewMockTransactionManager()
	svc := service.NewBusinessService(repo, tokenMaker, txManager, nil, "", "", "")
	h := handler.NewBusinessHandler(svc)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/business/login", h.Login)
	mux.HandleFunc("GET /v1/auth/business/oauth/google", h.GoogleOAuthRedirect)
	mux.HandleFunc("GET /v1/auth/business/oauth/google/callback", h.GoogleOAuthCallback)
	return svc, h, mux
}

func TestFeatureBusinessLogin(t *testing.T) {
	repo := &MockBusinessLoginRepository{}
	_, _, mux := newLoginTestSvc(repo)

	hashed, _ := bcrypt.GenerateFromPassword([]byte("secret123"), bcrypt.DefaultCost)
	hashedStr := string(hashed)
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-abc",
		Email:    "login@test.com",
		Password: &hashedStr,
	})

	// Akun Google-only
	googleID := "goog-123"
	repo.businesses = append(repo.businesses, &domain.Business{
		ID:       "id-google",
		Email:    "google@test.com",
		GoogleID: &googleID,
	})

	post := func(payload map[string]string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/business/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		return rr
	}

	t.Run("login valid", func(t *testing.T) {
		rr := post(map[string]string{"email": "login@test.com", "password": "secret123"})
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("password salah", func(t *testing.T) {
		rr := post(map[string]string{"email": "login@test.com", "password": "wrong"})
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("email tidak ditemukan", func(t *testing.T) {
		rr := post(map[string]string{"email": "ghost@test.com", "password": "secret123"})
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("password kosong", func(t *testing.T) {
		rr := post(map[string]string{"email": "login@test.com", "password": ""})
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("akun Google-only ditolak login native", func(t *testing.T) {
		rr := post(map[string]string{"email": "google@test.com", "password": "apapun"})
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})
}

func TestFeatureGoogleOAuthRedirect(t *testing.T) {
	_, _, mux := newLoginTestSvc(&MockBusinessLoginRepository{})

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/business/oauth/google", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	// Harus redirect ke Google
	if rr.Code != http.StatusFound {
		t.Errorf("expected 302 Found, got %d", rr.Code)
	}

	location := rr.Header().Get("Location")
	if location == "" {
		t.Error("expected Location header untuk redirect OAuth")
	}

	// State cookie harus di-set
	cookies := rr.Result().Cookies()
	var stateCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "oauth_state" {
			stateCookie = c
			break
		}
	}
	if stateCookie == nil {
		t.Error("expected oauth_state cookie di-set")
	}
	if !stateCookie.HttpOnly {
		t.Error("expected oauth_state cookie HttpOnly")
	}
	if stateCookie.MaxAge != 300 {
		t.Errorf("expected MaxAge 300, got %d", stateCookie.MaxAge)
	}
}

func TestFeatureGoogleOAuthCallbackValidation(t *testing.T) {
	_, _, mux := newLoginTestSvc(&MockBusinessLoginRepository{})

	t.Run("tanpa state cookie ditolak", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/business/oauth/google/callback?code=abc&state=xyz", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rr.Code)
		}
	})

	t.Run("state mismatch ditolak", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/business/oauth/google/callback?code=abc&state=WRONG", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "CORRECT"})
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rr.Code)
		}
	})

	t.Run("tanpa code ditolak", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/business/oauth/google/callback?state=abc", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "abc"})
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rr.Code)
		}
	})

	t.Run("state cookie dihapus setelah callback", func(t *testing.T) {
		// State match tapi code tidak valid ke Google — tetap harus hapus cookie
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/business/oauth/google/callback?code=invalid-code&state=mystate", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "mystate"})
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		var deleted *http.Cookie
		for _, c := range rr.Result().Cookies() {
			if c.Name == "oauth_state" {
				deleted = c
				break
			}
		}
		if deleted == nil || deleted.MaxAge != -1 {
			t.Error("expected oauth_state cookie dihapus (MaxAge=-1)")
		}
	})
}

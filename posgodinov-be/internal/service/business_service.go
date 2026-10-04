package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/token"
	"posgodinov-backend/pkg/utils"
)

type businessService struct {
	repo          domain.BusinessRepository
	tokenMaker    token.TokenMaker
	txManager     database.TransactionManager
	tenantManager *database.BusinessDBManager
	oauthCfg      *oauth2.Config
}

func NewBusinessService(
	repo domain.BusinessRepository,
	tokenMaker token.TokenMaker,
	txManager database.TransactionManager,
	tenantManager *database.BusinessDBManager,
	googleClientID, googleClientSecret, googleRedirectURL string,
) domain.BusinessService {
	oauthCfg := &oauth2.Config{
		ClientID:     googleClientID,
		ClientSecret: googleClientSecret,
		RedirectURL:  googleRedirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
	return &businessService{
		repo:          repo,
		tokenMaker:    tokenMaker,
		txManager:     txManager,
		tenantManager: tenantManager,
		oauthCfg:      oauthCfg,
	}
}

func (s *businessService) Register(ctx context.Context, req *domain.RegisterBusinessRequest) (*domain.RegisterBusinessResponse, error) {
	if req.Password == "" {
		return nil, errors.New("password wajib diisi")
	}

	if req.Password != req.ConfirmationPassword {
		return nil, errors.New("password dan konfirmasi password tidak cocok")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("gagal mengenkripsi password")
	}

	id := utils.GenerateRandomString(8)
	serialBusiness := buildSerialBusiness(req.Name, req.OwnerName)

	hashed := string(hashedPassword)
	business := &domain.Business{
		ID:             id,
		SerialBusiness: serialBusiness,
		Email:          req.Email,
		Password:       &hashed,
		Name:           req.Name,
		OwnerName:      req.OwnerName,
	}

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		if err := s.repo.Create(txCtx, business); err != nil {
			return err
		}
		if s.tenantManager != nil {
			if err := s.tenantManager.CreateNewTenantDatabase(business.ID); err != nil {
				return fmt.Errorf("gagal membuat database tenant: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.buildAuthResponse(business)
}

func (s *businessService) Login(ctx context.Context, req *domain.LoginBusinessRequest) (*domain.LoginBusinessResponse, error) {
	if req.Password == "" {
		return nil, errors.New("password wajib diisi")
	}

	business, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("email atau password salah")
	}

	// Akun yang dibuat via Google tidak punya password.
	if business.Password == nil {
		return nil, errors.New("akun ini terdaftar via Google, gunakan login Google")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*business.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("email atau password salah")
	}

	resp, err := s.buildAuthResponse(business)
	if err != nil {
		return nil, err
	}
	return &domain.LoginBusinessResponse{
		Business:     resp.Business,
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
	}, nil
}

func (s *businessService) RefreshToken(ctx context.Context, req *domain.RefreshTokenRequest) (*domain.RefreshTokenResponse, error) {
	payload, err := s.tokenMaker.VerifyToken(req.RefreshToken)
	if err != nil {
		return nil, errors.New("refresh token tidak valid atau sudah kadaluarsa")
	}

	if payload.Type != "refresh" {
		return nil, errors.New("jenis token tidak valid")
	}

	business, err := s.repo.GetByEmail(ctx, payload.Email)
	if err != nil {
		return nil, errors.New("bisnis tidak ditemukan")
	}

	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "access",
	}, 24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat access token baru")
	}

	return &domain.RefreshTokenResponse{AccessToken: accessToken}, nil
}

func (s *businessService) GoogleOAuthURL(_ context.Context, state string) string {
	return s.oauthCfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (s *businessService) GoogleOAuthCallback(ctx context.Context, code, _ string) (*domain.LoginBusinessResponse, error) {
	oauthToken, err := s.oauthCfg.Exchange(ctx, code)
	if err != nil {
		return nil, errors.New("gagal menukar kode OAuth")
	}

	info, err := fetchGoogleUserInfo(ctx, oauthToken.AccessToken)
	if err != nil {
		return nil, err
	}

	googleID := info.Sub
	business, err := s.repo.GetByGoogleID(ctx, googleID)
	if err != nil {
		// Not found — upsert (link ke akun lama via email, atau buat baru).
		id := utils.GenerateRandomString(8)
		serialBusiness := buildSerialBusiness(info.Name, "")
		business = &domain.Business{
			ID:             id,
			SerialBusiness: serialBusiness,
			Email:          info.Email,
			GoogleID:       &googleID,
			Name:           info.Name,
			OwnerName:      info.Name,
		}

		if err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
			if err := s.repo.UpsertByGoogle(txCtx, business); err != nil {
				return err
			}
			// Fetch setelah upsert agar ID dan SerialBusiness konsisten dengan yang
			// tersimpan (conflict case: email sudah ada, ID-nya berbeda dari yang kita buat).
			fetched, err := s.repo.GetByEmail(txCtx, info.Email)
			if err != nil {
				return err
			}
			*business = *fetched

			if s.tenantManager != nil {
				// CreateNewTenantDatabase idempotent — aman dipanggil untuk akun lama.
				if err := s.tenantManager.CreateNewTenantDatabase(business.ID); err != nil {
					return fmt.Errorf("gagal membuat database tenant: %w", err)
				}
			}
			return nil
		}); err != nil {
			return nil, err
		}
	}

	resp, err := s.buildAuthResponse(business)
	if err != nil {
		return nil, err
	}
	return &domain.LoginBusinessResponse{
		Business:     resp.Business,
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
	}, nil
}

// buildAuthResponse membuat pasangan access+refresh token untuk business.
func (s *businessService) buildAuthResponse(business *domain.Business) (*domain.RegisterBusinessResponse, error) {
	accessToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "access",
	}, 24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat access token")
	}

	refreshToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    business.ID,
		Email: business.Email,
		Type:  "refresh",
	}, 7*24*time.Hour)
	if err != nil {
		return nil, errors.New("gagal membuat refresh token")
	}

	return &domain.RegisterBusinessResponse{
		Business:     business,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// buildSerialBusiness menghasilkan kode serial dari nama bisnis + pemilik + tanggal.
func buildSerialBusiness(name, ownerName string) string {
	namePrefix := "XXX"
	if len(name) >= 3 {
		namePrefix = strings.ToUpper(name[:3])
	} else if len(name) > 0 {
		namePrefix = strings.ToUpper(name)
	}

	ownerPrefix := "XX"
	if len(ownerName) >= 2 {
		ownerPrefix = strings.ToUpper(ownerName[:2])
	} else if len(ownerName) > 0 {
		ownerPrefix = strings.ToUpper(ownerName)
	}

	return fmt.Sprintf("%s%s%s", namePrefix, ownerPrefix, time.Now().Format("020106"))
}

type googleUserInfo struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func fetchGoogleUserInfo(ctx context.Context, accessToken string) (*googleUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, errors.New("gagal membuat request ke Google")
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New("gagal mengambil info pengguna dari Google")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("Google menolak access token")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.New("gagal membaca respons Google")
	}

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, errors.New("gagal memproses data pengguna dari Google")
	}

	if info.Sub == "" || info.Email == "" {
		return nil, errors.New("data pengguna Google tidak lengkap")
	}

	return &info, nil
}

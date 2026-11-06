package service

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/token"
)

type posAuthService struct {
	businessRepo    domain.BusinessRepository
	outletRepo      domain.OutletRepository
	tokenMaker      token.TokenMaker
	businessManager *database.BusinessDBManager
	policyEngine    domain.PolicyEngine
}

func NewPOSAuthService(
	businessRepo domain.BusinessRepository,
	outletRepo domain.OutletRepository,
	tokenMaker token.TokenMaker,
	businessManager *database.BusinessDBManager,
	policyEngines ...domain.PolicyEngine,
) domain.POSAuthService {
	var pe domain.PolicyEngine
	if len(policyEngines) > 0 {
		pe = policyEngines[0]
	}
	return &posAuthService{
		businessRepo:    businessRepo,
		outletRepo:      outletRepo,
		tokenMaker:      tokenMaker,
		businessManager: businessManager,
		policyEngine:    pe,
	}
}

func (s *posAuthService) BindDevice(ctx context.Context, req *domain.DeviceBindRequest) (*domain.DeviceBindResponse, error) {
	// 1. Get Business by Serial
	business, err := s.businessRepo.GetBySerialBusiness(ctx, req.SerialBusiness)
	if err != nil {
		return nil, errors.New("kredensial bisnis tidak valid")
	}

	// 2. Validate Password
	if business.Password == nil {
		return nil, errors.New("kredensial bisnis tidak valid")
	}
	err = bcrypt.CompareHashAndPassword([]byte(*business.Password), []byte(req.Password))
	if err != nil {
		return nil, errors.New("kredensial bisnis tidak valid")
	}

	if s.policyEngine != nil {
		if policy, pErr := s.policyEngine.GetEffectivePolicy(ctx, business.ID); pErr == nil && policy != nil && policy.Status == "SUSPENDED" {
			return nil, errors.New("akun bisnis Anda ditangguhkan (SUSPENDED), silakan hubungi customer support")
		}
	}

	businessCtx := ctx
	if s.businessManager != nil {
		businessDB, err := s.businessManager.GetBusinessDB(ctx, business.ID)
		if err != nil {
			return nil, errors.New("gagal terhubung ke database bisnis")
		}
		businessCtx = context.WithValue(ctx, database.BusinessDBKey, businessDB)
	}

	// 3. Get Outlet by Serial Outlet
	outlet, err := s.outletRepo.GetBySerialOutlet(businessCtx, business.ID, req.SerialOutlet)
	if err != nil {
		return nil, errors.New("serial outlet tidak valid untuk bisnis ini")
	}

	// 4. Tentukan scope perangkat — butir 4 ([11 §M16.1]).
	//
	// Hanya dua nilai yang diterima. Scope yang tidak dikenal DITOLAK, bukan
	// dijatuhkan ke bawaan: teknisi yang salah ketik `OPNAM` akan memasang
	// perangkat gudang dengan hak akses kasir penuh, dan tidak ada yang
	// menyadarinya sampai ada yang memakainya.
	scope := req.Scope
	if scope == "" {
		scope = token.ScopePOS
	}
	if scope != token.ScopePOS && scope != token.ScopeOpname {
		return nil, errors.New("scope perangkat tidak dikenal: harus 'POS' atau 'OPNAME'")
	}

	// 5. Generate Device Token (90 days ~ 2160 hours)
	deviceToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:         outlet.ID,
		Email:      business.ID, // We store BusinessID in Email field for convenience in middleware
		BusinessID: business.ID,
		Type:       "device",
		Scope:      scope,
	}, 2160*time.Hour)
	
	if err != nil {
		return nil, errors.New("gagal membuat device token")
	}

	return &domain.DeviceBindResponse{
		DeviceToken: deviceToken,
	}, nil
}

package service

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/token"
)

type posAuthService struct {
	businessRepo domain.BusinessRepository
	outletRepo   domain.OutletRepository
	tokenMaker   token.TokenMaker
}

func NewPOSAuthService(
	businessRepo domain.BusinessRepository,
	outletRepo domain.OutletRepository,
	tokenMaker token.TokenMaker,
) domain.POSAuthService {
	return &posAuthService{
		businessRepo: businessRepo,
		outletRepo:   outletRepo,
		tokenMaker:   tokenMaker,
	}
}

func (s *posAuthService) BindDevice(ctx context.Context, req *domain.DeviceBindRequest) (*domain.DeviceBindResponse, error) {
	// 1. Get Business by Serial
	business, err := s.businessRepo.GetBySerialBusiness(ctx, req.SerialBusiness)
	if err != nil {
		return nil, errors.New("kredensial bisnis tidak valid")
	}

	// 2. Validate Password
	err = bcrypt.CompareHashAndPassword([]byte(business.Password), []byte(req.Password))
	if err != nil {
		return nil, errors.New("kredensial bisnis tidak valid")
	}

	// 3. Get Outlet by Serial Tenant
	outlet, err := s.outletRepo.GetBySerialTenant(ctx, business.ID, req.SerialOutlet)
	if err != nil {
		return nil, errors.New("serial outlet tidak valid untuk bisnis ini")
	}

	// 4. Generate Device Token (Long lived token, e.g. 10 years ~ 87600 hours)
	deviceToken, err := s.tokenMaker.CreateToken(token.Payload{
		ID:    outlet.ID,
		Email: business.ID, // We store BusinessID in Email field for convenience in middleware
		Type:  "device",
	}, 87600*time.Hour)
	
	if err != nil {
		return nil, errors.New("gagal membuat device token")
	}

	return &domain.DeviceBindResponse{
		DeviceToken: deviceToken,
	}, nil
}

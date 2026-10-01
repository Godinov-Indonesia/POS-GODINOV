package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/domain"
)

var (
	ErrOutletNotFound  = errors.New("outlet tidak ditemukan")
	ErrOutletForbidden = errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
)

// assertOutlet verifies that the outlet exists and belongs to the specified business.
func assertOutlet(ctx context.Context, repo domain.OutletRepository, businessID, outletID string) (*domain.Outlet, error) {
	outlet, err := repo.GetByID(ctx, outletID)
	if err != nil {
		return nil, ErrOutletNotFound
	}
	if outlet.BusinessID != businessID {
		return nil, ErrOutletForbidden
	}
	return outlet, nil
}

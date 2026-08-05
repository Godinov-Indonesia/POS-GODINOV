package service

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/domain"
)

type staffService struct {
	staffRepo  domain.StaffRepository
	outletRepo domain.OutletRepository
}

func NewStaffService(staffRepo domain.StaffRepository, outletRepo domain.OutletRepository) domain.StaffService {
	return &staffService{
		staffRepo:  staffRepo,
		outletRepo: outletRepo,
	}
}

func (s *staffService) RegisterStaff(ctx context.Context, businessID string, req *domain.CreateStaffRequest) (*domain.Staff, error) {
	if req.OutletID == "" || req.StaffIdentifier == "" || req.Name == "" || req.PIN == "" {
		return nil, errors.New("data pendaftaran tidak lengkap")
	}

	if len(req.PIN) < 4 || len(req.PIN) > 6 {
		return nil, errors.New("PIN harus terdiri dari 4 sampai 6 karakter")
	}

	// 1. Pastikan outlet ada dan milik businessID ini
	outlet, err := s.outletRepo.GetByID(ctx, req.OutletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	// 2. Cek apakah staff_identifier sudah dipakai di outlet ini
	existing, _ := s.staffRepo.GetByStaffIdentifier(ctx, req.OutletID, req.StaffIdentifier)
	if existing != nil {
		return nil, errors.New("ID/Username staff sudah digunakan di outlet ini")
	}

	// 3. Hash PIN
	hashedPin, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("gagal memproses PIN kasir")
	}

	staff := &domain.Staff{
		OutletID:        req.OutletID,
		StaffIdentifier: req.StaffIdentifier,
		Email:           req.Email,
		Name:            req.Name,
		PINHash:         string(hashedPin),
		Role:            domain.RoleCashier,
		IsActive:        true,
	}

	if err := s.staffRepo.Create(ctx, staff); err != nil {
		return nil, errors.New("gagal mendaftarkan kasir ke database")
	}

	return staff, nil
}

func (s *staffService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.Staff, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	return s.staffRepo.GetAllByOutletID(ctx, outletID)
}

func (s *staffService) GetAllByBusiness(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	if businessID == "" {
		return nil, errors.New("business ID tidak boleh kosong")
	}

	return s.staffRepo.GetAllByBusinessID(ctx, businessID)
}

func (s *staffService) UpdateStaff(ctx context.Context, businessID, staffID string, req *domain.UpdateStaffRequest) (*domain.Staff, error) {
	staff, err := s.staffRepo.GetByID(ctx, staffID)
	if err != nil {
		return nil, err
	}

	outlet, err := s.outletRepo.GetByID(ctx, staff.OutletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: staff ini bukan milik bisnis Anda")
	}

	// Cek identifier duplicate if changed
	if req.StaffIdentifier != "" && req.StaffIdentifier != staff.StaffIdentifier {
		existingStaff, _ := s.staffRepo.GetByStaffIdentifier(ctx, staff.OutletID, req.StaffIdentifier)
		if existingStaff != nil {
			return nil, errors.New("staff identifier sudah digunakan di outlet ini")
		}
		staff.StaffIdentifier = req.StaffIdentifier
	}

	if req.Name != "" {
		staff.Name = req.Name
	}
	if req.Email != nil {
		staff.Email = req.Email
	}
	if req.IsActive != nil {
		staff.IsActive = *req.IsActive
	}

	if err := s.staffRepo.Update(ctx, staff); err != nil {
		return nil, errors.New("gagal mengupdate staff")
	}

	return staff, nil
}

func (s *staffService) DeleteStaff(ctx context.Context, businessID, staffID string) error {
	staff, err := s.staffRepo.GetByID(ctx, staffID)
	if err != nil {
		return err
	}

	outlet, err := s.outletRepo.GetByID(ctx, staff.OutletID)
	if err != nil {
		return errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return errors.New("akses ditolak: staff ini bukan milik bisnis Anda")
	}

	if err := s.staffRepo.Delete(ctx, staffID); err != nil {
		return errors.New("gagal menghapus staff")
	}

	return nil
}

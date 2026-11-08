package unit

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type mockPOSMobileCredentialRepo struct {
	items map[string]*domain.POSMobileCredential
}

func newMockPOSMobileCredentialRepo() *mockPOSMobileCredentialRepo {
	return &mockPOSMobileCredentialRepo{
		items: make(map[string]*domain.POSMobileCredential),
	}
}

func (m *mockPOSMobileCredentialRepo) Create(ctx context.Context, cred *domain.POSMobileCredential) error {
	for _, it := range m.items {
		if strings.EqualFold(it.Code, cred.Code) {
			return errors.New("duplicate code")
		}
	}
	m.items[cred.ID] = cred
	return nil
}

func (m *mockPOSMobileCredentialRepo) GetByID(ctx context.Context, id string) (*domain.POSMobileCredential, error) {
	if it, ok := m.items[id]; ok {
		return it, nil
	}
	return nil, errors.New("kredensial pos mobile tidak ditemukan")
}

func (m *mockPOSMobileCredentialRepo) GetByCode(ctx context.Context, code string) (*domain.POSMobileCredential, error) {
	for _, it := range m.items {
		if strings.EqualFold(it.Code, code) {
			return it, nil
		}
	}
	return nil, errors.New("kredensial pos mobile tidak ditemukan")
}

func (m *mockPOSMobileCredentialRepo) List(ctx context.Context, search string, isActive *bool, page, limit int) ([]domain.POSMobileCredential, int64, error) {
	var res []domain.POSMobileCredential
	for _, it := range m.items {
		if search != "" && !strings.Contains(strings.ToLower(it.Label), strings.ToLower(search)) &&
			!strings.Contains(strings.ToLower(it.Code), strings.ToLower(search)) {
			continue
		}
		if isActive != nil && it.IsActive != *isActive {
			continue
		}
		res = append(res, *it)
	}
	return res, int64(len(res)), nil
}

func (m *mockPOSMobileCredentialRepo) Update(ctx context.Context, cred *domain.POSMobileCredential) error {
	m.items[cred.ID] = cred
	return nil
}

func (m *mockPOSMobileCredentialRepo) Delete(ctx context.Context, id string) error {
	if _, ok := m.items[id]; !ok {
		return errors.New("kredensial pos mobile tidak ditemukan")
	}
	delete(m.items, id)
	return nil
}

func (m *mockPOSMobileCredentialRepo) IncrementUsage(ctx context.Context, id string) error {
	if it, ok := m.items[id]; ok {
		now := time.Now()
		it.LastUsedAt = &now
		return nil
	}
	return errors.New("not found")
}

func TestPOSMobileCredentialService_Create(t *testing.T) {
	ctx := context.Background()
	repo := newMockPOSMobileCredentialRepo()
	svc := service.NewPOSMobileCredentialService(repo)

	// 1. Label empty
	_, err := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Label: "",
	})
	if err == nil {
		t.Fatal("expected error when label is empty")
	}

	// 2. Auto-generated code
	cred, err := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Label: "Terminal Sunmi Kasir 1",
	})
	if err != nil {
		t.Fatalf("unexpected error creating credential: %v", err)
	}
	if !strings.HasPrefix(cred.Code, "POS-") {
		t.Fatalf("expected generated code to start with 'POS-', got %s", cred.Code)
	}
	if !cred.IsActive {
		t.Fatal("expected credential to be active by default")
	}

	// 3. Custom code
	custom, err := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Code:  "MY-CUSTOM-KEY-1234",
		Label: "Terminal Tablet iPad",
	})
	if err != nil {
		t.Fatalf("unexpected error with custom code: %v", err)
	}
	if custom.Code != "MY-CUSTOM-KEY-1234" {
		t.Fatalf("expected custom code 'MY-CUSTOM-KEY-1234', got %s", custom.Code)
	}

	// 4. Duplicate code rejected
	_, err = svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Code:  "MY-CUSTOM-KEY-1234",
		Label: "Duplicate Terminal",
	})
	if err == nil {
		t.Fatal("expected duplicate code error")
	}
}

func TestPOSMobileCredentialService_UpdateAndDelete(t *testing.T) {
	ctx := context.Background()
	repo := newMockPOSMobileCredentialRepo()
	svc := service.NewPOSMobileCredentialService(repo)

	cred, err := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Label: "Initial Label",
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	// Update
	newLabel := "Updated Label"
	active := false
	maxUsage := 5
	updated, err := svc.Update(ctx, "admin-1", cred.ID, &domain.UpdatePOSMobileCredentialRequest{
		Label:    &newLabel,
		IsActive: &active,
		MaxUsage: &maxUsage,
	})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Label != "Updated Label" || updated.IsActive != false || updated.MaxUsage != 5 {
		t.Fatalf("update fields mismatch: %+v", updated)
	}

	// Delete
	err = svc.Delete(ctx, "admin-1", cred.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	_, err = svc.GetByID(ctx, cred.ID)
	if err == nil {
		t.Fatal("expected error getting deleted credential")
	}
}

func TestPOSMobileCredentialService_Verify(t *testing.T) {
	ctx := context.Background()
	repo := newMockPOSMobileCredentialRepo()
	svc := service.NewPOSMobileCredentialService(repo)

	// 1. Verify valid credential
	cred, err := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Code:     "POS-VERIFY-TEST-0001",
		Label:    "Device Under Test",
		MaxUsage: 2,
	})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	res, err := svc.Verify(ctx, "pos-verify-test-0001") // test case insensitivity
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if !res.Valid || res.CredentialID != cred.ID {
		t.Fatalf("verify response invalid: %+v", res)
	}

	// 2. Check second verification (within limit)
	res2, err := svc.Verify(ctx, "POS-VERIFY-TEST-0001")
	if err != nil {
		t.Fatalf("second verify failed: %v", err)
	}
	if !res2.Valid {
		t.Fatal("expected second verify to be valid")
	}

	// 3. Exceeded max usage (limit = 2)
	_, err = svc.Verify(ctx, "POS-VERIFY-TEST-0001")
	if err == nil || !strings.Contains(err.Error(), "batas penggunaan") {
		t.Fatalf("expected max usage error, got: %v", err)
	}

	// 4. Inactive credential
	inactiveCred, _ := svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Code:  "POS-INACTIVE-TEST-01",
		Label: "Inactive Device",
	})
	activeVal := false
	_, _ = svc.Update(ctx, "admin-1", inactiveCred.ID, &domain.UpdatePOSMobileCredentialRequest{
		IsActive: &activeVal,
	})
	_, err = svc.Verify(ctx, "POS-INACTIVE-TEST-01")
	if err == nil || !strings.Contains(err.Error(), "dinonaktifkan") {
		t.Fatalf("expected inactive error, got: %v", err)
	}

	// 5. Expired credential
	expiredTime := time.Now().Add(-1 * time.Hour)
	_, _ = svc.Create(ctx, "admin-1", &domain.CreatePOSMobileCredentialRequest{
		Code:      "POS-EXPIRED-TEST-01",
		Label:     "Expired Device",
		ExpiresAt: &expiredTime,
	})
	_, err = svc.Verify(ctx, "POS-EXPIRED-TEST-01")
	if err == nil || !strings.Contains(err.Error(), "kadaluarsa") {
		t.Fatalf("expected expired error, got: %v", err)
	}

	// 6. Unknown code
	_, err = svc.Verify(ctx, "NON-EXISTENT-CODE")
	if err == nil {
		t.Fatal("expected not found error")
	}
}

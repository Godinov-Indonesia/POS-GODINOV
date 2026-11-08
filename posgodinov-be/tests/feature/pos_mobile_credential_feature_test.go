package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/service"
)

type mockFeaturePOSMobileCredentialRepo struct {
	items map[string]*domain.POSMobileCredential
}

func newMockFeaturePOSMobileCredentialRepo() *mockFeaturePOSMobileCredentialRepo {
	return &mockFeaturePOSMobileCredentialRepo{
		items: make(map[string]*domain.POSMobileCredential),
	}
}

func (m *mockFeaturePOSMobileCredentialRepo) Create(ctx context.Context, cred *domain.POSMobileCredential) error {
	m.items[cred.ID] = cred
	return nil
}

func (m *mockFeaturePOSMobileCredentialRepo) GetByID(ctx context.Context, id string) (*domain.POSMobileCredential, error) {
	if it, ok := m.items[id]; ok {
		return it, nil
	}
	return nil, errors.New("kredensial pos mobile tidak ditemukan")
}

func (m *mockFeaturePOSMobileCredentialRepo) GetByCode(ctx context.Context, code string) (*domain.POSMobileCredential, error) {
	for _, it := range m.items {
		if strings.EqualFold(it.Code, code) {
			return it, nil
		}
	}
	return nil, errors.New("kredensial pos mobile tidak ditemukan")
}

func (m *mockFeaturePOSMobileCredentialRepo) List(ctx context.Context, search string, isActive *bool, page, limit int) ([]domain.POSMobileCredential, int64, error) {
	var list []domain.POSMobileCredential
	for _, it := range m.items {
		list = append(list, *it)
	}
	return list, int64(len(list)), nil
}

func (m *mockFeaturePOSMobileCredentialRepo) Update(ctx context.Context, cred *domain.POSMobileCredential) error {
	m.items[cred.ID] = cred
	return nil
}

func (m *mockFeaturePOSMobileCredentialRepo) Delete(ctx context.Context, id string) error {
	if _, ok := m.items[id]; !ok {
		return errors.New("kredensial pos mobile tidak ditemukan")
	}
	delete(m.items, id)
	return nil
}

func (m *mockFeaturePOSMobileCredentialRepo) IncrementUsage(ctx context.Context, id string) error {
	if it, ok := m.items[id]; ok {
		now := time.Now()
		it.LastUsedAt = &now
		return nil
	}
	return errors.New("not found")
}

func TestPOSMobileCredentialHandler_CRUDAndVerify(t *testing.T) {
	repo := newMockFeaturePOSMobileCredentialRepo()
	svc := service.NewPOSMobileCredentialService(repo)
	h := handler.NewPOSMobileCredentialHandler(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/landlord/pos-credentials", h.List)
	mux.HandleFunc("POST /v1/landlord/pos-credentials", h.Create)
	mux.HandleFunc("GET /v1/landlord/pos-credentials/{id}", h.Get)
	mux.HandleFunc("PUT /v1/landlord/pos-credentials/{id}", h.Update)
	mux.HandleFunc("DELETE /v1/landlord/pos-credentials/{id}", h.Delete)
	mux.HandleFunc("POST /v1/auth/pos-mobile/verify", h.Verify)

	// 1. Create with auto-generated code
	createReq := domain.CreatePOSMobileCredentialRequest{
		Label: "Terminal POS Toko 1",
		Notes: "Khusus kasir kasir shift pagi",
	}
	body, _ := json.Marshal(createReq)
	req := httptest.NewRequest("POST", "/v1/landlord/pos-credentials", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createResp struct {
		Status string                     `json:"status"`
		Data   domain.POSMobileCredential `json:"data"`
	}
	json.NewDecoder(rec.Body).Decode(&createResp)
	created := createResp.Data
	if !strings.HasPrefix(created.Code, "POS-") {
		t.Fatalf("expected code with POS- prefix, got %s", created.Code)
	}

	// 2. List
	reqList := httptest.NewRequest("GET", "/v1/landlord/pos-credentials", nil)
	recList := httptest.NewRecorder()
	mux.ServeHTTP(recList, reqList)
	if recList.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recList.Code)
	}

	// 3. Verify from app
	verifyReq := domain.VerifyPOSMobileCredentialRequest{
		Key: created.Code,
	}
	vBody, _ := json.Marshal(verifyReq)
	reqVerify := httptest.NewRequest("POST", "/v1/auth/pos-mobile/verify", bytes.NewReader(vBody))
	recVerify := httptest.NewRecorder()
	mux.ServeHTTP(recVerify, reqVerify)

	if recVerify.Code != http.StatusOK {
		t.Fatalf("expected verify 200, got %d: %s", recVerify.Code, recVerify.Body.String())
	}

	var verifyResp struct {
		Status string                                   `json:"status"`
		Data   domain.VerifyPOSMobileCredentialResponse `json:"data"`
	}
	json.NewDecoder(recVerify.Body).Decode(&verifyResp)
	if !verifyResp.Data.Valid {
		t.Fatalf("expected valid true, got false")
	}

	// 4. Update
	newLabel := "Terminal POS Kasir Diperbarui"
	updateReq := domain.UpdatePOSMobileCredentialRequest{
		Label: &newLabel,
	}
	uBody, _ := json.Marshal(updateReq)
	reqUpdate := httptest.NewRequest("PUT", "/v1/landlord/pos-credentials/"+created.ID, bytes.NewReader(uBody))
	recUpdate := httptest.NewRecorder()
	mux.ServeHTTP(recUpdate, reqUpdate)
	if recUpdate.Code != http.StatusOK {
		t.Fatalf("expected update 200, got %d", recUpdate.Code)
	}

	// 5. Delete
	reqDel := httptest.NewRequest("DELETE", "/v1/landlord/pos-credentials/"+created.ID, nil)
	recDel := httptest.NewRecorder()
	mux.ServeHTTP(recDel, reqDel)
	if recDel.Code != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", recDel.Code)
	}
}

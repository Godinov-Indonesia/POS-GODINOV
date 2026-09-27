package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type mockFeatureSOOpnameRepo struct {
	sessions     map[string]*domain.OpnameSession
	formItems    map[string][]*domain.OpnameFormItem
	countEntries map[string][]*domain.OpnameCountEntry
	sessionItems map[string][]*domain.OpnameSessionItem
}

func newMockFeatureSOOpnameRepo() *mockFeatureSOOpnameRepo {
	return &mockFeatureSOOpnameRepo{
		sessions:     make(map[string]*domain.OpnameSession),
		formItems:    make(map[string][]*domain.OpnameFormItem),
		countEntries: make(map[string][]*domain.OpnameCountEntry),
		sessionItems: make(map[string][]*domain.OpnameSessionItem),
	}
}

func (m *mockFeatureSOOpnameRepo) Create(ctx context.Context, session *domain.OpnameSession) error {
	m.sessions[session.ID] = session
	return nil
}

func (m *mockFeatureSOOpnameRepo) GetByID(ctx context.Context, id string) (*domain.OpnameSession, error) {
	s, ok := m.sessions[id]
	if !ok {
		return nil, errors.New("session not found")
	}
	return s, nil
}

func (m *mockFeatureSOOpnameRepo) ListByOutlet(ctx context.Context, outletID string, statuses []string, limit, offset int) ([]*domain.OpnameSession, error) {
	var res []*domain.OpnameSession
	for _, s := range m.sessions {
		if s.OutletID != outletID {
			continue
		}
		if len(statuses) > 0 {
			match := false
			for _, st := range statuses {
				if s.Status == st {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		}
		res = append(res, s)
	}
	return res, nil
}

func (m *mockFeatureSOOpnameRepo) SetFormItems(ctx context.Context, sessionID string, rawMaterialIDs []string) error {
	var items []*domain.OpnameFormItem
	for _, rmID := range rawMaterialIDs {
		items = append(items, &domain.OpnameFormItem{
			ID:            rmID + "_item",
			SessionID:     sessionID,
			RawMaterialID: rmID,
		})
	}
	m.formItems[sessionID] = items
	return nil
}

func (m *mockFeatureSOOpnameRepo) ListFormItems(ctx context.Context, sessionID string) ([]*domain.OpnameFormItem, error) {
	return m.formItems[sessionID], nil
}

func (m *mockFeatureSOOpnameRepo) UpsertCountEntries(ctx context.Context, entries []*domain.OpnameCountEntry) error {
	for _, entry := range entries {
		existing := m.countEntries[entry.SessionID]
		found := false
		for i, e := range existing {
			if e.RawMaterialID == entry.RawMaterialID && e.CountedBy == entry.CountedBy {
				existing[i].ActualStock = entry.ActualStock
				existing[i].ActualPackageQuantity = entry.ActualPackageQuantity
				existing[i].InputType = entry.InputType
				existing[i].Notes = entry.Notes
				found = true
				break
			}
		}
		if !found {
			m.countEntries[entry.SessionID] = append(m.countEntries[entry.SessionID], entry)
		}
	}
	return nil
}

func (m *mockFeatureSOOpnameRepo) ListCountEntries(ctx context.Context, sessionID string) ([]*domain.OpnameCountEntry, error) {
	return m.countEntries[sessionID], nil
}

func (m *mockFeatureSOOpnameRepo) ListCountEntriesByStaff(ctx context.Context, sessionID, staffID string) ([]*domain.OpnameCountEntry, error) {
	var res []*domain.OpnameCountEntry
	for _, e := range m.countEntries[sessionID] {
		if e.CountedBy == staffID {
			res = append(res, e)
		}
	}
	return res, nil
}

func (m *mockFeatureSOOpnameRepo) HasCountEntries(ctx context.Context, sessionID string) (bool, error) {
	return len(m.countEntries[sessionID]) > 0, nil
}

func (m *mockFeatureSOOpnameRepo) ListItems(ctx context.Context, sessionID string) ([]*domain.OpnameSessionItem, error) {
	return m.sessionItems[sessionID], nil
}

func (m *mockFeatureSOOpnameRepo) Publish(ctx context.Context, sessionID string, publishedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusOpen {
		return errors.New("cannot publish")
	}
	s.Status = domain.SOStatusPublished
	s.PublishedAt = &publishedAt
	return nil
}

func (m *mockFeatureSOOpnameRepo) MarkCounting(ctx context.Context, sessionID string) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusPublished {
		return errors.New("cannot mark counting")
	}
	s.Status = domain.SOStatusCounting
	return nil
}

func (m *mockFeatureSOOpnameRepo) Close(ctx context.Context, sessionID string, closedAt time.Time, closedBy string) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusCounting {
		return errors.New("cannot close")
	}
	s.Status = domain.SOStatusClosed
	s.ClosedAt = &closedAt
	s.ClosedBy = &closedBy

	// Aggregate counts into sessionItems
	materialTotals := make(map[string]float64)
	for _, ce := range m.countEntries[sessionID] {
		materialTotals[ce.RawMaterialID] += ce.ActualStock
	}

	var items []*domain.OpnameSessionItem
	for rmID, totalActual := range materialTotals {
		sys := 100.0
		diff := totalActual - sys
		diffVal := diff * 1000.0
		items = append(items, &domain.OpnameSessionItem{
			ID:              rmID + "_res",
			SessionID:       sessionID,
			RawMaterialID:   rmID,
			ActualStock:     totalActual,
			SystemStock:     &sys,
			Difference:      &diff,
			DifferenceValue: &diffVal,
		})
	}
	m.sessionItems[sessionID] = items
	return nil
}

func (m *mockFeatureSOOpnameRepo) Approve(ctx context.Context, sessionID string, approvedBy string, approvedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusClosed {
		return errors.New("cannot approve")
	}
	s.Status = domain.SOStatusApproved
	s.ApprovedBy = &approvedBy
	s.ApprovedAt = &approvedAt
	return nil
}

func (m *mockFeatureSOOpnameRepo) Reject(ctx context.Context, sessionID string, rejectedBy string, rejectedAt time.Time) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.Status != domain.SOStatusClosed {
		return errors.New("cannot reject")
	}
	s.Status = domain.SOStatusRejected
	s.ApprovedBy = &rejectedBy
	s.ApprovedAt = &rejectedAt
	return nil
}

func (m *mockFeatureSOOpnameRepo) GetRecountChain(ctx context.Context, sessionID string) ([]*domain.OpnameSession, error) {
	var chain []*domain.OpnameSession
	curr := m.sessions[sessionID]
	for curr != nil {
		chain = append([]*domain.OpnameSession{curr}, chain...)
		if curr.RecountOf == nil {
			break
		}
		curr = m.sessions[*curr.RecountOf]
	}
	return chain, nil
}

func TestSOFormFeatureFlow(t *testing.T) {
	outletRepo := &MockFeatureOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "out-1", BusinessID: "biz-1", Name: "Outlet Utama"},
		},
	}
	rmRepo := &MockFeatureRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm-1", OutletID: "out-1", Name: "Kopi Arabika", Stock: 100, CostPerUnit: 1000},
			{ID: "rm-2", OutletID: "out-1", Name: "Gula Pasir", Stock: 100, CostPerUnit: 500},
		},
	}
	soRepo := newMockFeatureSOOpnameRepo()
	txManager := database.NewMockTransactionManager()

	svc := service.NewOpnameSessionService(soRepo, rmRepo, outletRepo, txManager)
	h := handler.NewOpnameSessionHandler(svc)

	tokenMaker, _ := token.NewPasetoMaker("01234567890123456789012345678901")

	// Helper for business token (Admin)
	adminToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "biz-1",
		Email: "owner@godinov.com",
		Type:  "access",
	}, time.Hour)

	// Helper for device token (Cashier / SO app)
	deviceToken, _ := tokenMaker.CreateToken(token.Payload{
		ID:    "out-1",
		Email: "biz-1",
		Type:  "device",
		Scope: token.ScopeOpname,
	}, time.Hour)

	// Admin wrapper: injects AuthPayloadKey
	adminAuth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			payload := &token.Payload{ID: "biz-1", Email: "owner@godinov.com", Type: "access"}
			ctx := context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}

	// Device wrapper: injects AuthPayloadKey with ScopeOpname
	deviceAuth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			payload := &token.Payload{ID: "out-1", Email: "biz-1", Type: "device", Scope: token.ScopeOpname}
			ctx := context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}

	mux := http.NewServeMux()
	// Admin endpoints
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms", adminAuth(h.CreateForm))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/so/forms", adminAuth(h.ListForms))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/so/forms/{form_id}", adminAuth(h.GetFormDetail))
	mux.HandleFunc("PUT /v1/business/outlets/{outlet_id}/so/forms/{form_id}/items", adminAuth(h.UpdateFormItems))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/publish", adminAuth(h.PublishForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/close", adminAuth(h.CloseForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/approve", adminAuth(h.ApproveForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/reject", adminAuth(h.RejectForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/recount", adminAuth(h.RecountForm))

	// Mobile endpoints
	mux.HandleFunc("GET /v1/so/available", deviceAuth(h.ListAvailable))
	mux.HandleFunc("GET /v1/so/{form_id}", deviceAuth(h.GetFormForCounting))
	mux.HandleFunc("PUT /v1/so/{form_id}/counts", deviceAuth(h.SubmitCounts))
	mux.HandleFunc("GET /v1/so/{form_id}/my-counts", deviceAuth(h.GetMyCounts))

	var formID string

	t.Run("1. Admin Creates SO Form", func(t *testing.T) {
		body := map[string]interface{}{
			"scope":            "FULL",
			"notes":            "SO Bulanan Gudang",
			"raw_material_ids": []string{"rm-1", "rm-2"},
		}
		jsonBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/v1/business/outlets/out-1/so/forms", bytes.NewBuffer(jsonBytes))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Data struct {
				ID        string `json:"id"`
				Status    string `json:"status"`
				Materials []any  `json:"materials"`
			} `json:"data"`
		}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.Data.Status != "OPEN" {
			t.Errorf("expected status OPEN, got %s", resp.Data.Status)
		}
		if len(resp.Data.Materials) != 2 {
			t.Errorf("expected 2 materials, got %d", len(resp.Data.Materials))
		}
		formID = resp.Data.ID
	})

	t.Run("2. Admin Updates Material List", func(t *testing.T) {
		body := map[string]interface{}{
			"raw_material_ids": []string{"rm-1"},
		}
		jsonBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/items", formID), bytes.NewBuffer(jsonBytes))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}

		// Re-add rm-2 back
		body["raw_material_ids"] = []string{"rm-1", "rm-2"}
		jsonBytes, _ = json.Marshal(body)
		req = httptest.NewRequest(http.MethodPut, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/items", formID), bytes.NewBuffer(jsonBytes))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		rr = httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("3. Admin Publishes Form", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/publish", formID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("4. Mobile SO App Lists Available Forms (Blind Opname check)", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/so/available", nil)
		req.Header.Set("Authorization", "Bearer "+deviceToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}

		// Assert blind opname: raw response string MUST NOT contain "system_stock"
		bodyStr := rr.Body.String()
		if bytes.Contains(rr.Body.Bytes(), []byte("system_stock")) {
			t.Errorf("SECURITY LEAK: available forms response contains system_stock: %s", bodyStr)
		}
	})

	t.Run("5. Cashier 1 Submits Partial Counts", func(t *testing.T) {
		body := map[string]interface{}{
			"items": []map[string]interface{}{
				{"raw_material_id": "rm-1", "actual_stock": 45.0, "input_type": "base_unit"},
				{"raw_material_id": "rm-2", "actual_stock": 60.0, "input_type": "base_unit"},
			},
		}
		jsonBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/v1/so/%s/counts", formID), bytes.NewBuffer(jsonBytes))
		req.Header.Set("Authorization", "Bearer "+deviceToken)
		req.Header.Set("X-Staff-Id", "staff-kasir-1")
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("6. Cashier 2 Submits Counts for same form", func(t *testing.T) {
		body := map[string]interface{}{
			"items": []map[string]interface{}{
				{"raw_material_id": "rm-1", "actual_stock": 50.0, "input_type": "base_unit"},
			},
		}
		jsonBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/v1/so/%s/counts", formID), bytes.NewBuffer(jsonBytes))
		req.Header.Set("Authorization", "Bearer "+deviceToken)
		req.Header.Set("X-Staff-Id", "staff-kasir-2")
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("7. Cashier 1 Checks My-Counts", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/v1/so/%s/my-counts", formID), nil)
		req.Header.Set("Authorization", "Bearer "+deviceToken)
		req.Header.Set("X-Staff-Id", "staff-kasir-1")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Data struct {
				CountedBy string `json:"counted_by"`
				Items     []any  `json:"items"`
			} `json:"data"`
		}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.Data.CountedBy != "staff-kasir-1" {
			t.Errorf("expected counted_by staff-kasir-1, got %s", resp.Data.CountedBy)
		}
		if len(resp.Data.Items) != 2 {
			t.Errorf("expected 2 items, got %d", len(resp.Data.Items))
		}
	})

	t.Run("8. Admin Closes Form", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/close", formID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Data domain.SOClosedResponse `json:"data"`
		}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.Data.Status != "CLOSED" {
			t.Errorf("expected status CLOSED, got %s", resp.Data.Status)
		}
		if len(resp.Data.CountSheets) != 2 {
			t.Errorf("expected 2 count sheets (1 per cashier), got %d", len(resp.Data.CountSheets))
		}

		// Verify sum for rm-1: 45 + 50 = 95
		var rm1Final *domain.SOFinalSheetItem
		for _, it := range resp.Data.FinalSheet.Items {
			if it.RawMaterialID == "rm-1" {
				rm1Final = it
				break
			}
		}
		if rm1Final == nil {
			t.Fatal("expected rm-1 in final sheet")
		}
		if rm1Final.ActualStock != 95 {
			t.Errorf("expected rm-1 actual stock 95, got %f", rm1Final.ActualStock)
		}
	})

	t.Run("9. Admin Recounts Form", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/recount", formID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Data domain.SOFormResponse `json:"data"`
		}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.Data.Status != "OPEN" {
			t.Errorf("expected recount form to be OPEN, got %s", resp.Data.Status)
		}
		if resp.Data.RecountOf == nil || *resp.Data.RecountOf != formID {
			t.Errorf("expected recount_of %s, got %v", formID, resp.Data.RecountOf)
		}
		if resp.Data.RecountNumber != 1 {
			t.Errorf("expected recount_number 1, got %d", resp.Data.RecountNumber)
		}
	})

	t.Run("10. Admin Approves Original Form", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/v1/business/outlets/out-1/so/forms/%s/approve", formID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
		}

		var resp struct {
			Data domain.OpnameApproveResult `json:"data"`
		}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.Data.Status != "APPROVED" {
			t.Errorf("expected status APPROVED, got %s", resp.Data.Status)
		}

		// rm-1 stock was 100, actual was 95 (diff = -5), stock adjusted = 100 + (-5) = 95
		rm1, _ := rmRepo.GetByID(context.Background(), "rm-1")
		if rm1.Stock != 95 {
			t.Errorf("expected rm-1 stock 95, got %f", rm1.Stock)
		}
	})
}

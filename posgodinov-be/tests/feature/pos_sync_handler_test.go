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

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/token"
)

type MockPOSSyncRepository struct {
	transactions map[string]*domain.Transaction
	shifts       map[string]*domain.Shift
	wastes       map[string]*domain.ProductWaste
}

func NewMockPOSSyncRepository() *MockPOSSyncRepository {
	return &MockPOSSyncRepository{
		transactions: make(map[string]*domain.Transaction),
		shifts:       make(map[string]*domain.Shift),
		wastes:       make(map[string]*domain.ProductWaste),
	}
}

// SaveShift MENYIMPAN, bukan sekadar mengembalikan nil.
//
// Versi lama membuang argumennya, sehingga uji apa pun yang memeriksa isi shift
// yang tersimpan akan selalu melihat nil — dan lolos tanpa membuktikan apa pun.
// Uji aturan R4 (`expected_*` tidak boleh diterima dari klien) justru bergantung
// pada pemeriksaan itu.
func (m *MockPOSSyncRepository) SaveShift(ctx context.Context, shift *domain.Shift) error {
	m.shifts[shift.ID] = shift
	return nil
}
func (m *MockPOSSyncRepository) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	if s, ok := m.shifts[id]; ok {
		return s, nil
	}
	return nil, errors.New("not found")
}
func (m *MockPOSSyncRepository) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	m.transactions[trx.ID] = trx
	return nil
}
func (m *MockPOSSyncRepository) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	if t, ok := m.transactions[id]; ok {
		return t, nil
	}
	return nil, errors.New("not found")
}
func (m *MockPOSSyncRepository) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	return nil
}
func (m *MockPOSSyncRepository) LookupTransaction(ctx context.Context, outletID, code string) (*domain.Transaction, error) {
	trimmed := strings.TrimSpace(code)
	if trimmed == "" {
		return nil, errors.New("kode transaksi kosong")
	}
	upper := strings.ToUpper(trimmed)
	for _, t := range m.transactions {
		if t.OutletID != outletID {
			continue
		}
		if t.ID == trimmed || (t.ShortCode != nil && *t.ShortCode == upper) {
			return t, nil
		}
	}
	return nil, errors.New("transaksi tidak ditemukan")
}

func (m *MockPOSSyncRepository) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	return nil, nil
}

// SaveProductWaste MENYIMPAN, bukan sekadar mengembalikan nil.
//
// Versi lama membuang argumennya, sehingga uji yang memeriksa baris
// `product_wastes` turunan retur ([11 §M13.6]) akan selalu melihat peta kosong
// dan lolos tanpa membuktikan apa pun.
func (m *MockPOSSyncRepository) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	m.wastes[waste.ID] = waste
	return nil
}
func (m *MockPOSSyncRepository) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	if w, ok := m.wastes[id]; ok {
		return w, nil
	}
	return nil, errors.New("not found")
}

type MockProductRepoForSync struct {
	products map[string]*domain.Product
}

func (m *MockProductRepoForSync) CreateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	return nil
}
func (m *MockProductRepoForSync) CreateBulkProductsWithRecipes(ctx context.Context, products []*domain.Product) error {
	return nil
}
func (m *MockProductRepoForSync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Product, error) {
	return []*domain.Product{}, nil
}
func (m *MockProductRepoForSync) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	if p, ok := m.products[id]; ok {
		return p, nil
	}
	return nil, errors.New("not found")
}
func (m *MockProductRepoForSync) DeleteProduct(ctx context.Context, id string) error { return nil }
func (m *MockProductRepoForSync) UpdateProductWithRecipes(ctx context.Context, product *domain.Product) error {
	return nil
}

type MockRawMaterialRepoForSync struct {
	rms map[string]*domain.RawMaterial
}

func (m *MockRawMaterialRepoForSync) Create(ctx context.Context, rm *domain.RawMaterial) error {
	return nil
}
func (m *MockRawMaterialRepoForSync) CreateBulk(ctx context.Context, rawMaterials []*domain.RawMaterial) error {
	return nil
}
func (m *MockRawMaterialRepoForSync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RawMaterial, error) {
	return nil, nil
}
func (m *MockRawMaterialRepoForSync) GetByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	if r, ok := m.rms[id]; ok {
		return r, nil
	}
	return nil, errors.New("not found")
}
func (m *MockRawMaterialRepoForSync) GetByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}
func (m *MockRawMaterialRepoForSync) LockByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	return m.GetByID(ctx, id)
}
func (m *MockRawMaterialRepoForSync) LockByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) {
	return nil, nil
}
func (m *MockRawMaterialRepoForSync) UpdateStock(ctx context.Context, id string, newStock float64) error {
	return nil
}
func (m *MockRawMaterialRepoForSync) UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error {
	return nil
}
func (m *MockRawMaterialRepoForSync) Update(ctx context.Context, rm *domain.RawMaterial) error {
	m.rms[rm.ID] = rm
	return nil
}
func (m *MockRawMaterialRepoForSync) Delete(ctx context.Context, id string) error { return nil }

type MockStaffRepoForSync struct{}

func (m *MockStaffRepoForSync) Create(ctx context.Context, staff *domain.Staff) error { return nil }
func (m *MockStaffRepoForSync) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepoForSync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepoForSync) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepoForSync) GetByID(ctx context.Context, id string) (*domain.Staff, error) {
	return nil, nil
}
func (m *MockStaffRepoForSync) Update(ctx context.Context, staff *domain.Staff) error { return nil }
func (m *MockStaffRepoForSync) Delete(ctx context.Context, id string) error           { return nil }

type MockProductCategoryRepoForSync struct{}

func (m *MockProductCategoryRepoForSync) Create(ctx context.Context, category *domain.ProductCategory) error {
	return nil
}
func (m *MockProductCategoryRepoForSync) CreateBulk(ctx context.Context, categories []*domain.ProductCategory) error {
	return nil
}
func (m *MockProductCategoryRepoForSync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.ProductCategory, error) {
	return []*domain.ProductCategory{}, nil
}
func (m *MockProductCategoryRepoForSync) GetByID(ctx context.Context, id string) (*domain.ProductCategory, error) {
	return nil, nil
}

func TestPOSSyncHandler(t *testing.T) {
	staffRepo := &MockStaffRepoForSync{}
	catRepo := &MockProductCategoryRepoForSync{}
	productRepo := &MockProductRepoForSync{
		products: map[string]*domain.Product{
			"prod-1": {ID: "prod-1", Recipes: []*domain.ProductRecipe{{RawMaterialID: "rm-1", Quantity: 1}}},
		},
	}
	posRepo := NewMockPOSSyncRepository()
	rmRepo := &MockRawMaterialRepoForSync{
		rms: map[string]*domain.RawMaterial{"rm-1": {ID: "rm-1", Stock: 10}},
	}
	txManager := database.NewMockTransactionManager()

	svc := service.NewPOSSyncService(staffRepo, catRepo, productRepo, posRepo, rmRepo, txManager)
	h := handler.NewPOSSyncHandler(svc)

	mux := http.NewServeMux()
	// Add mock middleware wrapper to inject token
	mux.HandleFunc("GET /v1/pos/sync/master-data", func(w http.ResponseWriter, r *http.Request) {
		payload := &token.Payload{Email: "biz-1", ID: "out-1", Type: "device"}
		ctx := context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)
		h.GetMasterData(w, r.WithContext(ctx))
	})
	mux.HandleFunc("POST /v1/pos/sync", func(w http.ResponseWriter, r *http.Request) {
		payload := &token.Payload{Email: "biz-1", ID: "out-1", Type: "device"}
		ctx := context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)
		h.SyncUp(w, r.WithContext(ctx))
	})

	t.Run("Get Master Data", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/pos/sync/master-data", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})

	t.Run("Sync Up", func(t *testing.T) {
		reqBody := &domain.SyncUpRequestV2{SyncUpRequest: domain.SyncUpRequest{
			Transactions: []*domain.Transaction{
				{
					ID:     "trx-100",
					Status: "COMPLETED",
					Items:  []*domain.TransactionItem{{ProductID: "prod-1", Quantity: 2}},
				},
			},
		}}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/v1/pos/sync", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rr.Code)
		}
	})
}

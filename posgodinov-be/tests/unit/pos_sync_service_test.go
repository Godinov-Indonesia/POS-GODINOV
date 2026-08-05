package unit

import (
	"context"
	"errors"
	"testing"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type MockPOSRepository struct {
	shifts       map[string]*domain.Shift
	transactions map[string]*domain.Transaction
	wastes       map[string]*domain.ProductWaste
}

func NewMockPOSRepository() *MockPOSRepository {
	return &MockPOSRepository{
		shifts:       make(map[string]*domain.Shift),
		transactions: make(map[string]*domain.Transaction),
		wastes:       make(map[string]*domain.ProductWaste),
	}
}

func (m *MockPOSRepository) SaveShift(ctx context.Context, shift *domain.Shift) error {
	m.shifts[shift.ID] = shift
	return nil
}

func (m *MockPOSRepository) GetShiftByID(ctx context.Context, id string) (*domain.Shift, error) {
	if s, ok := m.shifts[id]; ok {
		return s, nil
	}
	return nil, errors.New("not found")
}

func (m *MockPOSRepository) SaveTransaction(ctx context.Context, trx *domain.Transaction) error {
	m.transactions[trx.ID] = trx
	return nil
}

func (m *MockPOSRepository) GetTransactionByID(ctx context.Context, id string) (*domain.Transaction, error) {
	if t, ok := m.transactions[id]; ok {
		return t, nil
	}
	return nil, errors.New("not found")
}
func (m *MockPOSRepository) GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*domain.Transaction, error) {
	return nil, nil
}

func (m *MockPOSRepository) UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error {
	if t, ok := m.transactions[id]; ok {
		t.Status = status
		t.CancelNotes = cancelNotes
		return nil
	}
	return errors.New("not found")
}

func (m *MockPOSRepository) SaveProductWaste(ctx context.Context, waste *domain.ProductWaste) error {
	m.wastes[waste.ID] = waste
	return nil
}

func (m *MockPOSRepository) GetProductWasteByID(ctx context.Context, id string) (*domain.ProductWaste, error) {
	if w, ok := m.wastes[id]; ok {
		return w, nil
	}
	return nil, errors.New("not found")
}

// Mock ProductRepository
type MockProductRepository_Sync struct {
	products map[string]*domain.Product
}

func (m *MockProductRepository_Sync) CreateProductWithRecipes(ctx context.Context, product *domain.Product) error { return nil }
func (m *MockProductRepository_Sync) CreateBulkProductsWithRecipes(ctx context.Context, products []*domain.Product) error { return nil }
func (m *MockProductRepository_Sync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Product, error) { return nil, nil }
func (m *MockProductRepository_Sync) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	if p, ok := m.products[id]; ok {
		return p, nil
	}
	return nil, errors.New("not found")
}
func (m *MockProductRepository_Sync) DeleteProduct(ctx context.Context, id string) error { return nil }
func (m *MockProductRepository_Sync) UpdateProductWithRecipes(ctx context.Context, product *domain.Product) error { return nil }

// Mock RawMaterialRepository
type MockRawMaterialRepository_Sync struct {
	rms map[string]*domain.RawMaterial
}

func (m *MockRawMaterialRepository_Sync) Create(ctx context.Context, rawMaterial *domain.RawMaterial) error { return nil }
func (m *MockRawMaterialRepository_Sync) CreateBulk(ctx context.Context, rawMaterials []*domain.RawMaterial) error { return nil }
func (m *MockRawMaterialRepository_Sync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RawMaterial, error) { return nil, nil }
func (m *MockRawMaterialRepository_Sync) GetByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	if r, ok := m.rms[id]; ok {
		return r, nil
	}
	return nil, errors.New("not found")
}
func (m *MockRawMaterialRepository_Sync) GetByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) { return nil, nil }
func (m *MockRawMaterialRepository_Sync) LockByID(ctx context.Context, id string) (*domain.RawMaterial, error) {
	return m.GetByID(ctx, id)
}
func (m *MockRawMaterialRepository_Sync) LockByIDs(ctx context.Context, ids []string) (map[string]*domain.RawMaterial, error) { return nil, nil }
func (m *MockRawMaterialRepository_Sync) UpdateStock(ctx context.Context, id string, newStock float64) error { return nil }
func (m *MockRawMaterialRepository_Sync) UpdateStockAndCost(ctx context.Context, id string, newStock, newCost float64) error { return nil }
func (m *MockRawMaterialRepository_Sync) Update(ctx context.Context, rawMaterial *domain.RawMaterial) error {
	m.rms[rawMaterial.ID] = rawMaterial
	return nil
}
func (m *MockRawMaterialRepository_Sync) Delete(ctx context.Context, id string) error { return nil }

// Mock StaffRepository
type MockStaffRepository_Sync struct{}
func (m *MockStaffRepository_Sync) Create(ctx context.Context, staff *domain.Staff) error { return nil }
func (m *MockStaffRepository_Sync) GetByStaffIdentifier(ctx context.Context, outletID, staffIdentifier string) (*domain.Staff, error) { return nil, nil }
func (m *MockStaffRepository_Sync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.Staff, error) { return nil, nil }
func (m *MockStaffRepository_Sync) GetAllByBusinessID(ctx context.Context, businessID string) ([]*domain.Staff, error) { return nil, nil }
func (m *MockStaffRepository_Sync) GetByID(ctx context.Context, id string) (*domain.Staff, error) { return nil, nil }
func (m *MockStaffRepository_Sync) Update(ctx context.Context, staff *domain.Staff) error { return nil }
func (m *MockStaffRepository_Sync) Delete(ctx context.Context, id string) error { return nil }

// Mock ProductCategoryRepository
type MockProductCategoryRepository_Sync struct{}
func (m *MockProductCategoryRepository_Sync) Create(ctx context.Context, category *domain.ProductCategory) error { return nil }
func (m *MockProductCategoryRepository_Sync) CreateBulk(ctx context.Context, categories []*domain.ProductCategory) error { return nil }
func (m *MockProductCategoryRepository_Sync) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.ProductCategory, error) { return nil, nil }
func (m *MockProductCategoryRepository_Sync) GetByID(ctx context.Context, id string) (*domain.ProductCategory, error) { return nil, nil }


func TestSyncUp(t *testing.T) {
	ctx := context.Background()

	staffRepo := &MockStaffRepository_Sync{}
	catRepo := &MockProductCategoryRepository_Sync{}
	productRepo := &MockProductRepository_Sync{
		products: map[string]*domain.Product{
			"prod-1": {
				ID: "prod-1",
				Recipes: []*domain.ProductRecipe{
					{RawMaterialID: "rm-1", Quantity: 2},
				},
			},
		},
	}
	posRepo := NewMockPOSRepository()
	rmRepo := &MockRawMaterialRepository_Sync{
		rms: map[string]*domain.RawMaterial{
			"rm-1": {ID: "rm-1", Stock: 10},
		},
	}
	txManager := database.NewMockTransactionManager()

	svc := service.NewPOSSyncService(staffRepo, catRepo, productRepo, posRepo, rmRepo, txManager)

	// 1. New Transaction (Completed)
	req1 := &domain.SyncUpRequest{
		Transactions: []*domain.Transaction{
			{
				ID:     "trx-1",
				Status: "COMPLETED",
				Items: []*domain.TransactionItem{
					{ProductID: "prod-1", Quantity: 1}, // Deducts 2 rm-1
				},
			},
		},
	}

	res, err := svc.SyncUp(ctx, "biz-1", "out-1", req1)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.TransactionsSynced != 1 {
		t.Errorf("expected 1 transaction synced, got %d", res.TransactionsSynced)
	}
	
	rm1, _ := rmRepo.GetByID(ctx, "rm-1")
	if rm1.Stock != 8 {
		t.Errorf("expected rm-1 stock to be 8, got %f", rm1.Stock)
	}

	// 2. Idempotency Check (Duplicate Transaction)
	res, err = svc.SyncUp(ctx, "biz-1", "out-1", req1)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.TransactionsSynced != 1 { // Should still report 1 synced (handled silently)
		t.Errorf("expected 1 transaction synced, got %d", res.TransactionsSynced)
	}
	if rm1.Stock != 8 { // Stock should NOT be deducted again
		t.Errorf("expected rm-1 stock to still be 8, got %f", rm1.Stock)
	}

	// 3. Cancel Transaction (Reverse Deduction)
	req2 := &domain.SyncUpRequest{
		Transactions: []*domain.Transaction{
			{
				ID:     "trx-1",
				Status: "CANCELLED", // Already exists as COMPLETED, so it will reverse
				Items: []*domain.TransactionItem{
					{ProductID: "prod-1", Quantity: 1},
				},
			},
		},
	}

	res, err = svc.SyncUp(ctx, "biz-1", "out-1", req2)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rm1.Stock != 10 { // Stock should be returned
		t.Errorf("expected rm-1 stock to be 10, got %f", rm1.Stock)
	}
	trx1, _ := posRepo.GetTransactionByID(ctx, "trx-1")
	if trx1.Status != "CANCELLED" {
		t.Errorf("expected status CANCELLED, got %s", trx1.Status)
	}

	// 4. Negative Stock Allowed
	req3 := &domain.SyncUpRequest{
		Transactions: []*domain.Transaction{
			{
				ID:     "trx-2",
				Status: "COMPLETED",
				Items: []*domain.TransactionItem{
					{ProductID: "prod-1", Quantity: 10}, // Deducts 20 rm-1, stock is 10 -> -10
				},
			},
		},
	}
	_, err = svc.SyncUp(ctx, "biz-1", "out-1", req3)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rm1.Stock != -10 { // Allowed negative stock
		t.Errorf("expected rm-1 stock to be -10, got %f", rm1.Stock)
	}
}

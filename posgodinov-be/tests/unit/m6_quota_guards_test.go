package unit

import (
	"context"
	"errors"
	"testing"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/service"
)

type mockM6PolicyEngine struct {
	allowedFeatures map[string]bool
	numericLimits   map[string]int64
}

func (m *mockM6PolicyEngine) GetEffectivePolicy(ctx context.Context, businessID string) (*domain.EffectivePolicy, error) {
	return nil, nil
}

func (m *mockM6PolicyEngine) AssertQuota(ctx context.Context, businessID, featureKey string, currentUsage int64) error {
	limit, ok := m.numericLimits[featureKey]
	if !ok || limit == -1 {
		return nil
	}
	if currentUsage > limit {
		return &service.QuotaExceededError{
			FeatureKey:   featureKey,
			CurrentUsage: currentUsage,
			LimitValue:   limit,
		}
	}
	return nil
}

func (m *mockM6PolicyEngine) AssertFeature(ctx context.Context, businessID, featureKey string) error {
	if m.allowedFeatures != nil && m.allowedFeatures[featureKey] {
		return nil
	}
	return errors.New("fitur ini tidak tersedia pada paket Anda, silakan tingkatkan ke Pro")
}

func (m *mockM6PolicyEngine) GetNumericLimit(ctx context.Context, businessID, featureKey string) (int64, error) {
	if m.numericLimits != nil {
		if val, ok := m.numericLimits[featureKey]; ok {
			return val, nil
		}
	}
	return -1, nil
}

func (m *mockM6PolicyEngine) InvalidateCache(businessID string) {}

func (m *mockM6PolicyEngine) InvalidatePlan(ctx context.Context, planID string) error {
	return nil
}

type mockM6WasteRepo struct {
	logs []*domain.WasteLog
}

func (m *mockM6WasteRepo) Create(ctx context.Context, log *domain.WasteLog) error {
	m.logs = append(m.logs, log)
	return nil
}

func (m *mockM6WasteRepo) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.WasteLog, error) {
	var res []*domain.WasteLog
	for _, l := range m.logs {
		if l.OutletID == outletID {
			res = append(res, l)
		}
	}
	return res, nil
}

type mockM6RestockRepo struct {
	logs []*domain.RestockLog
}

func (m *mockM6RestockRepo) Create(ctx context.Context, log *domain.RestockLog) error {
	m.logs = append(m.logs, log)
	return nil
}

func (m *mockM6RestockRepo) GetAllByOutletID(ctx context.Context, outletID string) ([]*domain.RestockLog, error) {
	var res []*domain.RestockLog
	for _, l := range m.logs {
		if l.OutletID == outletID {
			res = append(res, l)
		}
	}
	return res, nil
}

func TestM6_ReportService_ExportQuotaGuard(t *testing.T) {
	ctx := context.Background()

	reportRepo := &MockReportRepository{
		Transactions: []*domain.Transaction{
			{ID: "trx1", BusinessID: "biz1", OutletID: "out1", Status: "COMPLETED", TotalAmount: 50000},
		},
	}
	wasteRepo := &mockM6WasteRepo{
		logs: []*domain.WasteLog{
			{ID: "w1", OutletID: "out1", Quantity: 5, Reason: "Expired"},
		},
	}
	restockRepo := &mockM6RestockRepo{
		logs: []*domain.RestockLog{
			{ID: "r1", OutletID: "out1", Quantity: 10, TotalCost: 100000},
		},
	}

	filter := domain.ReportFilter{
		BusinessID: "biz1",
		OutletID:   "out1",
	}

	t.Run("Rejected when export_reports is disabled", func(t *testing.T) {
		pe := &mockM6PolicyEngine{
			allowedFeatures: map[string]bool{"export_reports": false},
		}
		svc := service.NewReportService(
			reportRepo,
			service.WithReportPolicyEngine(pe),
			service.WithReportWasteLogRepo(wasteRepo),
			service.WithReportRestockLogRepo(restockRepo),
		)

		_, err := svc.Export(ctx, "transactions", filter)
		if err == nil {
			t.Fatal("expected error when export_reports is disabled, got nil")
		}
	})

	t.Run("Allowed when export_reports is enabled", func(t *testing.T) {
		pe := &mockM6PolicyEngine{
			allowedFeatures: map[string]bool{"export_reports": true},
		}
		svc := service.NewReportService(
			reportRepo,
			service.WithReportPolicyEngine(pe),
			service.WithReportWasteLogRepo(wasteRepo),
			service.WithReportRestockLogRepo(restockRepo),
		)

		// Test transactions export
		trxRes, err := svc.Export(ctx, "transactions", filter)
		if err != nil {
			t.Fatalf("unexpected error exporting transactions: %v", err)
		}
		trxs, ok := trxRes.([]*domain.Transaction)
		if !ok || len(trxs) != 1 {
			t.Fatalf("expected 1 transaction, got %v", trxRes)
		}

		// Test waste export
		wasteRes, err := svc.Export(ctx, "waste", filter)
		if err != nil {
			t.Fatalf("unexpected error exporting waste: %v", err)
		}
		wastes, ok := wasteRes.([]*domain.WasteLog)
		if !ok || len(wastes) != 1 {
			t.Fatalf("expected 1 waste log, got %v", wasteRes)
		}

		// Test restock export
		restockRes, err := svc.Export(ctx, "restock", filter)
		if err != nil {
			t.Fatalf("unexpected error exporting restock: %v", err)
		}
		restocks, ok := restockRes.([]*domain.RestockLog)
		if !ok || len(restocks) != 1 {
			t.Fatalf("expected 1 restock log, got %v", restockRes)
		}
	})
}

func TestM6_UploadService_CloudStorageQuotaGuard(t *testing.T) {
	ctx := context.Background()
	cfg := &config.Config{
		CloudinaryCloudName: "testcloud",
		CloudinaryAPIKey:    "testkey",
		CloudinaryAPISecret: "testsecret",
		CloudinaryFolder:    "posgodinov",
	}

	t.Run("Rejected when cloud_storage_mb is reached or exceeded", func(t *testing.T) {
		pe := &mockM6PolicyEngine{
			numericLimits: map[string]int64{"cloud_storage_mb": 100},
		}
		svc := service.NewUploadService(
			cfg,
			service.WithUploadPolicyEngine(pe),
			service.WithUploadStorageUsage(func(ctx context.Context, businessID string) (int64, error) {
				return 100, nil // 100 MB used, limit 100 MB -> should be rejected
			}),
		)

		_, err := svc.GenerateUploadSignature(ctx, "biz1", &domain.CreateUploadSignatureRequest{
			Purpose: domain.UploadPurposeProduct,
		})
		if err == nil {
			t.Fatal("expected QuotaExceededError, got nil")
		}
		var quotaErr *service.QuotaExceededError
		if !errors.As(err, &quotaErr) {
			t.Fatalf("expected *service.QuotaExceededError, got %T: %v", err, err)
		}
		if quotaErr.FeatureKey != "cloud_storage_mb" {
			t.Errorf("expected feature_key cloud_storage_mb, got %s", quotaErr.FeatureKey)
		}
	})

	t.Run("Allowed when cloud_storage_mb has available room", func(t *testing.T) {
		pe := &mockM6PolicyEngine{
			numericLimits: map[string]int64{"cloud_storage_mb": 100},
		}
		svc := service.NewUploadService(
			cfg,
			service.WithUploadPolicyEngine(pe),
			service.WithUploadStorageUsage(func(ctx context.Context, businessID string) (int64, error) {
				return 45, nil // 45 MB used, limit 100 MB
			}),
		)

		resp, err := svc.GenerateUploadSignature(ctx, "biz1", &domain.CreateUploadSignatureRequest{
			Purpose: domain.UploadPurposeProduct,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp == nil || resp.Signature == "" {
			t.Fatal("expected signature response, got nil/empty")
		}
	})

	t.Run("Allowed when cloud_storage_mb is unlimited (-1)", func(t *testing.T) {
		pe := &mockM6PolicyEngine{
			numericLimits: map[string]int64{"cloud_storage_mb": -1},
		}
		svc := service.NewUploadService(
			cfg,
			service.WithUploadPolicyEngine(pe),
			service.WithUploadStorageUsage(func(ctx context.Context, businessID string) (int64, error) {
				return 999999, nil
			}),
		)

		resp, err := svc.GenerateUploadSignature(ctx, "biz1", &domain.CreateUploadSignatureRequest{
			Purpose: domain.UploadPurposeProduct,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp == nil || resp.Signature == "" {
			t.Fatal("expected signature response, got nil/empty")
		}
	})
}

func TestM6_OpnameSessionService_CollaborativeQuotaGuard(t *testing.T) {
	ctx := context.Background()

	outletRepo := &MockOutletRepository{
		outlets: []*domain.Outlet{
			{ID: "out1", BusinessID: "biz1", Name: "Outlet 1"},
		},
	}
	rmRepo := &MockRawMaterialRepository{
		rawMaterials: []*domain.RawMaterial{
			{ID: "rm1", OutletID: "out1", Name: "Kopi", LooseStock: 100, CostPerUnit: 1000},
		},
	}
	txManager := database.NewMockTransactionManager()

	t.Run("Second staff rejected when stock_opname_collaborative is disabled", func(t *testing.T) {
		repo := newMockOpnameSessionRepo()
		pe := &mockM6PolicyEngine{
			allowedFeatures: map[string]bool{"stock_opname_collaborative": false},
		}

		svc := service.NewOpnameSessionService(
			repo, rmRepo, outletRepo, txManager,
			service.WithOpnamePolicyEngine(pe),
		)

		// Create & publish form
		form, err := svc.CreateForm(ctx, "biz1", "out1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			RawMaterialIDs: []string{"rm1"},
		})
		if err != nil {
			t.Fatalf("failed to create form: %v", err)
		}
		if err := svc.PublishForm(ctx, "biz1", "out1", form.ID); err != nil {
			t.Fatalf("failed to publish form: %v", err)
		}

		// Staff 1 submits counts -> should succeed
		err = svc.SubmitCounts(ctx, "biz1", "out1", form.ID, "staff_1", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualPackages: 1, ActualLoose: 10},
		})
		if err != nil {
			t.Fatalf("staff 1 submit count should succeed, got: %v", err)
		}

		// Staff 1 submits counts again (updating own count) -> should succeed
		err = svc.SubmitCounts(ctx, "biz1", "out1", form.ID, "staff_1", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualPackages: 1, ActualLoose: 15},
		})
		if err != nil {
			t.Fatalf("staff 1 update should succeed, got: %v", err)
		}

		// Staff 2 submits counts -> should be rejected because collaborative SO is disabled
		err = svc.SubmitCounts(ctx, "biz1", "out1", form.ID, "staff_2", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualPackages: 2, ActualLoose: 20},
		})
		if err == nil {
			t.Fatal("expected error when second staff submits without collaborative feature, got nil")
		}
		if !errors.Is(err, service.ErrSOCollaborativeForbidden) {
			t.Fatalf("expected ErrSOCollaborativeForbidden, got: %v", err)
		}
	})

	t.Run("Second staff allowed when stock_opname_collaborative is enabled", func(t *testing.T) {
		repo := newMockOpnameSessionRepo()
		pe := &mockM6PolicyEngine{
			allowedFeatures: map[string]bool{"stock_opname_collaborative": true},
		}

		svc := service.NewOpnameSessionService(
			repo, rmRepo, outletRepo, txManager,
			service.WithOpnamePolicyEngine(pe),
		)

		form, err := svc.CreateForm(ctx, "biz1", "out1", "admin1", &domain.CreateSOFormRequest{
			Scope:          domain.SOScopeFull,
			RawMaterialIDs: []string{"rm1"},
		})
		if err != nil {
			t.Fatalf("failed to create form: %v", err)
		}
		if err := svc.PublishForm(ctx, "biz1", "out1", form.ID); err != nil {
			t.Fatalf("failed to publish form: %v", err)
		}

		// Staff 1 submits counts
		err = svc.SubmitCounts(ctx, "biz1", "out1", form.ID, "staff_1", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualPackages: 1, ActualLoose: 10},
		})
		if err != nil {
			t.Fatalf("staff 1 submit count should succeed, got: %v", err)
		}

		// Staff 2 submits counts -> should succeed
		err = svc.SubmitCounts(ctx, "biz1", "out1", form.ID, "staff_2", []*domain.SubmitCountItemRequest{
			{RawMaterialID: "rm1", ActualPackages: 2, ActualLoose: 20},
		})
		if err != nil {
			t.Fatalf("staff 2 submit count should succeed when collaborative feature is enabled, got: %v", err)
		}
	})
}

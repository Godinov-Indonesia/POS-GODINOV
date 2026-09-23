package feature

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

// ════════════════════════════════════════════════════════════════════════════
// Uji kontrak sinkronisasi — Fase M11.3 ([11 §4.1])
//
// Dua hal yang dijaga berkas ini, dan keduanya adalah kegagalan yang mahal:
//
//  1. Perangkat lapangan yang belum diperbarui HARUS tetap dapat menyetorkan
//     penjualannya. Sebuah tablet yang mati dua minggu kembali membawa uang
//     yang sudah diterima; menolaknya berarti menghapus penjualan nyata.
//  2. Entitas v2 HARUS benar-benar tersimpan, dan yang cacat HARUS ditolak
//     dengan alasan yang dapat dibaca kasir — bukan hilang diam-diam.
// ════════════════════════════════════════════════════════════════════════════

/* ── Mock repositori v2 ───────────────────────────────────────────────────── */

type mockPaymentRepo struct {
	saved     map[string][]*domain.TransactionPayment
	summaries map[string]domain.TenderSummary
}

func newMockPaymentRepo() *mockPaymentRepo {
	return &mockPaymentRepo{
		saved:     map[string][]*domain.TransactionPayment{},
		summaries: map[string]domain.TenderSummary{},
	}
}

func (m *mockPaymentRepo) SaveMany(ctx context.Context, payments []*domain.TransactionPayment) error {
	for _, p := range payments {
		m.saved[p.TransactionID] = append(m.saved[p.TransactionID], p)
	}
	return nil
}

func (m *mockPaymentRepo) GetByTransactionID(ctx context.Context, id string) ([]*domain.TransactionPayment, error) {
	return m.saved[id], nil
}

func (m *mockPaymentRepo) UpdateSummary(ctx context.Context, id string, sum domain.TenderSummary) error {
	m.summaries[id] = sum
	return nil
}

type mockReturnRepo struct {
	saved map[string]*domain.Return
	// returned melaporkan kuantitas yang SUDAH diretur per transaction_item_id.
	returned map[string]int
	// original adalah kuantitas asal per transaction_item_id — di produksi ia
	// berasal dari baris `transaction_items` yang dikunci.
	original map[string]int
	// productOf memetakan item ke produknya; dipakai memverifikasi pergerakan
	// stok dan penulisan `product_wastes`.
	productOf map[string]string
	// returnState merekam nilai terakhir yang ditulis ke transaksi asal.
	returnState map[string]string
}

func newMockReturnRepo() *mockReturnRepo {
	return &mockReturnRepo{
		saved:       map[string]*domain.Return{},
		returned:    map[string]int{},
		original:    map[string]int{},
		productOf:   map[string]string{},
		returnState: map[string]string{},
	}
}

func (m *mockReturnRepo) Save(ctx context.Context, ret *domain.Return) error {
	m.saved[ret.ID] = ret
	for _, it := range ret.Items {
		m.returned[it.TransactionItemID] += it.Quantity
	}
	return nil
}

func (m *mockReturnRepo) GetByID(ctx context.Context, id string) (*domain.Return, error) {
	if r, ok := m.saved[id]; ok {
		return r, nil
	}
	return nil, errors.New("not found")
}

func (m *mockReturnRepo) ListByOriginalTransaction(ctx context.Context, id string) ([]*domain.Return, error) {
	return nil, nil
}

func (m *mockReturnRepo) SnapshotForReturn(ctx context.Context, id string) (*domain.ReturnSnapshot, error) {
	items := make([]*domain.ReturnableItem, 0, len(m.original))
	for itemID, qty := range m.original {
		already := m.returned[itemID]
		remaining := qty - already
		if remaining < 0 {
			remaining = 0
		}
		items = append(items, &domain.ReturnableItem{
			TransactionItemID: itemID,
			ProductID:         m.productOf[itemID],
			OriginalQuantity:  qty,
			AlreadyReturned:   already,
			Returnable:        remaining,
		})
	}
	return &domain.ReturnSnapshot{Items: items}, nil
}

func (m *mockReturnRepo) UpdateReturnState(ctx context.Context, transactionID, state string) error {
	m.returnState[transactionID] = state
	return nil
}

type mockVoidLogRepo struct{ saved map[string]*domain.VoidLog }

func newMockVoidLogRepo() *mockVoidLogRepo {
	return &mockVoidLogRepo{saved: map[string]*domain.VoidLog{}}
}
func (m *mockVoidLogRepo) Save(ctx context.Context, l *domain.VoidLog) error {
	m.saved[l.ID] = l
	return nil
}
func (m *mockVoidLogRepo) GetByID(ctx context.Context, id string) (*domain.VoidLog, error) {
	return nil, errors.New("not found")
}
func (m *mockVoidLogRepo) ListByShift(ctx context.Context, id string) ([]*domain.VoidLog, error) {
	return nil, nil
}

type mockSecurityEventRepo struct {
	saved map[string]*domain.SecurityEvent
}

func newMockSecurityEventRepo() *mockSecurityEventRepo {
	return &mockSecurityEventRepo{saved: map[string]*domain.SecurityEvent{}}
}
func (m *mockSecurityEventRepo) Save(ctx context.Context, e *domain.SecurityEvent) error {
	m.saved[e.ID] = e
	return nil
}
func (m *mockSecurityEventRepo) ListByOutlet(ctx context.Context, outletID string, limit, offset int) ([]*domain.SecurityEvent, error) {
	return nil, nil
}

type mockMasterVersionRepo struct{ version int64 }

func (m *mockMasterVersionRepo) Get(ctx context.Context, outletID string) (int64, error) {
	return m.version, nil
}
func (m *mockMasterVersionRepo) Bump(ctx context.Context, outletID string) (int64, error) {
	m.version++
	return m.version, nil
}

/* ── Harness ──────────────────────────────────────────────────────────────── */

type contractHarness struct {
	mux          *http.ServeMux
	posRepo      *MockPOSSyncRepository
	payments     *mockPaymentRepo
	returns      *mockReturnRepo
	voidLogs     *mockVoidLogRepo
	events       *mockSecurityEventRepo
	masterVers   *mockMasterVersionRepo
	rawMaterials *MockRawMaterialRepoForSync
	returnSvc    domain.ReturnService
}

func newContractHarness() *contractHarness {
	posRepo := NewMockPOSSyncRepository()
	payments := newMockPaymentRepo()
	returns := newMockReturnRepo()
	voidLogs := newMockVoidLogRepo()
	events := newMockSecurityEventRepo()
	masterVers := &mockMasterVersionRepo{version: 187}

	// ⚠️ SATU instance produk dan bahan baku dipakai layanan sync MAUPUN
	// layanan retur. Dua instance terpisah membuat pergerakan stok retur
	// tertulis di salinan yang tidak pernah diperiksa uji — dan seluruh
	// pemeriksaan stok lolos tanpa membuktikan apa pun.
	products := &MockProductRepoForSync{products: map[string]*domain.Product{
		"prod-1": {ID: "prod-1", Recipes: []*domain.ProductRecipe{{RawMaterialID: "rm-1", Quantity: 1}}},
	}}
	rawMaterials := &MockRawMaterialRepoForSync{
		rms: map[string]*domain.RawMaterial{"rm-1": {ID: "rm-1", Stock: 100}},
	}
	txManager := database.NewMockTransactionManager()

	returnSvc := service.NewReturnService(
		returns, posRepo, products, rawMaterials, txManager,
		// ID deterministik: uji tidak boleh bergantung pada keacakan.
		service.WithReturnIDGenerator(func() string { return "waste-generated" }),
	)

	svc := service.NewPOSSyncService(
		&MockStaffRepoForSync{},
		&MockProductCategoryRepoForSync{},
		products,
		posRepo,
		rawMaterials,
		txManager,
		service.WithPaymentRepository(payments),
		service.WithReturnService(returnSvc),
		service.WithVoidLogRepository(voidLogs),
		service.WithSecurityEventRepository(events),
		service.WithMasterVersionRepository(masterVers),
	)

	h := handler.NewPOSSyncHandler(svc)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/pos/sync", func(w http.ResponseWriter, r *http.Request) {
		payload := &token.Payload{Email: "biz-1", ID: "out-1", Type: "device"}
		h.SyncUp(w, r.WithContext(context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)))
	})
	mux.HandleFunc("GET /v1/pos/sync/master-data", func(w http.ResponseWriter, r *http.Request) {
		payload := &token.Payload{Email: "biz-1", ID: "out-1", Type: "device"}
		h.GetMasterData(w, r.WithContext(context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)))
	})

	rh := handler.NewPOSReturnHandler(returnSvc)
	mux.HandleFunc("GET /v1/pos/transactions/{id}/returnable", func(w http.ResponseWriter, r *http.Request) {
		payload := &token.Payload{Email: "biz-1", ID: "out-1", Type: "device"}
		rh.Returnable(w, r.WithContext(context.WithValue(r.Context(), middleware.AuthPayloadKey, payload)))
	})

	return &contractHarness{
		mux:          mux,
		posRepo:      posRepo,
		payments:     payments,
		returns:      returns,
		voidLogs:     voidLogs,
		events:       events,
		masterVers:   masterVers,
		rawMaterials: rawMaterials,
		returnSvc:    returnSvc,
	}
}

// post mengirim payload mentah agar uji dapat menyusun JSON persis seperti yang
// dikirim perangkat — termasuk bentuk v1 yang struct v2 tidak dapat hasilkan.
func (h *contractHarness) post(t *testing.T, contractVersion string, raw string) *domain.SyncUpResponse {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/v1/pos/sync", bytes.NewBufferString(raw))
	req.Header.Set("Content-Type", "application/json")
	if contractVersion != "" {
		req.Header.Set(domain.ContractVersionHeader, contractVersion)
	}

	rr := httptest.NewRecorder()
	h.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("diharapkan 200, dapat %d — body: %s", rr.Code, rr.Body.String())
	}
	if got := rr.Header().Get(domain.ContractSupportedHeader); got != domain.ContractSupportedVersion {
		t.Errorf("header %s = %q, diharapkan %q", domain.ContractSupportedHeader, got, domain.ContractSupportedVersion)
	}

	var envelope struct {
		Data *domain.SyncUpResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("gagal mengurai respons: %v — body: %s", err, rr.Body.String())
	}
	if envelope.Data == nil {
		t.Fatalf("respons tidak memuat data: %s", rr.Body.String())
	}
	return envelope.Data
}

/* ── v1 ───────────────────────────────────────────────────────────────────── */

// TestSyncContractV1Compat memastikan perangkat lama tetap dilayani.
func TestSyncContractV1Compat(t *testing.T) {
	t.Run("payload v1 tanpa header tetap 200 dan tersimpan", func(t *testing.T) {
		h := newContractHarness()

		// Bentuk PERSIS seperti yang dikirim klien v1: tanpa device_id, tanpa
		// payments, tanpa koleksi baru.
		res := h.post(t, "", `{
			"shifts": [],
			"transactions": [{
				"id": "trx-v1-1",
				"shift_id": "shift-1",
				"customer_name": "",
				"total_amount": 55000,
				"payment_method": "CASH",
				"status": "COMPLETED",
				"cancel_notes": "",
				"client_created_at": "2026-08-20T10:00:00Z",
				"items": [{"id":"it-1","product_id":"prod-1","quantity":2,"unit_price":27500}]
			}],
			"wastes": []
		}`)

		if res.TransactionsSynced != 1 {
			t.Fatalf("transactions_synced = %d, diharapkan 1 — errors: %+v", res.TransactionsSynced, res.Errors)
		}
		if len(res.Errors) != 0 {
			t.Errorf("diharapkan tanpa galat, dapat %+v", res.Errors)
		}
	})

	t.Run("DEBIT v1 tanpa trace number TIDAK ditolak", func(t *testing.T) {
		// Regresi yang paling mudah tercipta saat menambahkan butir 8: klien v1
		// mengirim `payment_method: "DEBIT"` tanpa trace number karena kolomnya
		// memang belum ada saat ia dirilis. Menuntut butir 8 pada tender hasil
		// rekonstruksi akan menolak SETIAP penjualan kartu di lapangan.
		h := newContractHarness()

		res := h.post(t, "", `{
			"transactions": [{
				"id": "trx-v1-debit",
				"shift_id": "shift-1",
				"total_amount": 100000,
				"payment_method": "DEBIT",
				"status": "COMPLETED",
				"client_created_at": "2026-08-20T10:00:00Z",
				"items": []
			}]
		}`)

		if res.TransactionsSynced != 1 {
			t.Fatalf("penjualan DEBIT v1 ditolak: %+v", res.Errors)
		}
		saved := h.payments.saved["trx-v1-debit"]
		if len(saved) != 1 {
			t.Fatalf("diharapkan 1 tender hasil sintesis, dapat %d", len(saved))
		}
		if !saved[0].IsReconstructed {
			t.Error("tender hasil sintesis wajib ditandai IsReconstructed — inilah yang mengecualikannya dari butir 8")
		}
	})

	t.Run("koleksi v2 pada permintaan berlabel v1 diabaikan", func(t *testing.T) {
		h := newContractHarness()

		res := h.post(t, domain.ContractVersionV1, `{
			"transactions": [],
			"void_logs": [{
				"id": "void-should-be-ignored",
				"shift_id": "shift-1",
				"staff_id": "staff-1",
				"scope": "CART_LINE",
				"product_id": "prod-1",
				"quantity_before": 10,
				"quantity_after": 3,
				"value_amount": 70000,
				"reason_code": "WRONG_QTY",
				"client_created_at": "2026-08-20T10:00:00Z"
			}]
		}`)

		if res.VoidLogsSynced != 0 {
			t.Errorf("void_logs pada permintaan v1 seharusnya diabaikan, tersimpan %d", res.VoidLogsSynced)
		}
		if len(h.voidLogs.saved) != 0 {
			t.Errorf("tidak boleh ada void log tersimpan, dapat %d", len(h.voidLogs.saved))
		}
	})
}

// seedPrintedTransaction menyiapkan transaksi asal yang struknya SUDAH terbit.
//
// Retur hanya sah untuk transaksi tercetak (butir 15); tanpa `ReceiptPrintedAt`
// seluruh skenario di bawah akan ditolak dengan alasan yang benar tetapi bukan
// alasan yang sedang diuji.
func (h *contractHarness) seedPrintedTransaction(id string, items map[string]int) {
	printed := time.Date(2026, 8, 20, 10, 14, 22, 0, time.UTC)

	trxItems := make([]*domain.TransactionItem, 0, len(items))
	for itemID, qty := range items {
		trxItems = append(trxItems, &domain.TransactionItem{
			ID: itemID, ProductID: "prod-1", Quantity: qty,
		})
		h.returns.original[itemID] = qty
		h.returns.productOf[itemID] = "prod-1"
	}

	h.posRepo.transactions[id] = &domain.Transaction{
		ID:               id,
		Status:           domain.TxStatusCompleted,
		ReceiptPrintedAt: &printed,
		Items:            trxItems,
	}
}

/* ── v2 ───────────────────────────────────────────────────────────────────── */

func TestSyncContractV2(t *testing.T) {
	t.Run("seluruh entitas baru tersimpan", func(t *testing.T) {
		h := newContractHarness()

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"master_data_version": 187,
			"transactions": [{
				"id": "trx-v2-1",
				"shift_id": "shift-1",
				"total_amount": 155000,
				"payment_method": "SPLIT",
				"status": "COMPLETED",
				"short_code": "OUT001-260820-K7QF1",
				"receipt_printed_at": "2026-08-20T10:14:22Z",
				"client_created_at": "2026-08-20T10:14:00Z",
				"payments": [
					{"id":"pay-1","sequence":1,"method":"CASH","amount":55000},
					{"id":"pay-2","sequence":2,"method":"DEBIT","amount":100000,
					 "trace_number":"004871","card_last4":"4417"}
				],
				"items": []
			}],
			"void_logs": [{
				"id": "void-1",
				"shift_id": "shift-1",
				"staff_id": "staff-1",
				"scope": "CART_LINE",
				"product_id": "prod-1",
				"quantity_before": 12,
				"quantity_after": 3,
				"value_amount": 247500,
				"reason_code": "WRONG_QTY",
				"receipt_printed": true,
				"client_created_at": "2026-08-20T10:00:00Z"
			}],
			"security_events": [{
				"id": "sec-1",
				"shift_id": "shift-1",
				"staff_id": "staff-1",
				"event_type": "KIOSK_EXIT_DENIED",
				"severity": "CRITICAL",
				"details": {"attempts": 3},
				"client_created_at": "2026-08-20T10:00:00Z"
			}]
		}`)

		if res.TransactionsSynced != 1 || res.VoidLogsSynced != 1 || res.SecurityEventsSynced != 1 {
			t.Fatalf("tersinkron trx=%d void=%d sec=%d — errors: %+v",
				res.TransactionsSynced, res.VoidLogsSynced, res.SecurityEventsSynced, res.Errors)
		}
		if res.MasterDataVersion != 187 {
			t.Errorf("master_data_version = %d, diharapkan 187", res.MasterDataVersion)
		}

		// Multi-tender benar-benar tersimpan sebagai DUA baris.
		if got := len(h.payments.saved["trx-v2-1"]); got != 2 {
			t.Fatalf("diharapkan 2 baris tender, dapat %d", got)
		}
		sum := h.payments.summaries["trx-v2-1"]
		if sum.PaymentMethod != domain.PaymentSummarySplit {
			t.Errorf("ringkasan = %q, diharapkan SPLIT", sum.PaymentMethod)
		}
		if sum.CashAmount != 55000 || sum.NonCashAmount != 100000 {
			t.Errorf("ringkasan tunai/non-tunai = %v/%v, diharapkan 55000/100000", sum.CashAmount, sum.NonCashAmount)
		}
		// Tender yang benar-benar dikirim perangkat TIDAK boleh ditandai
		// rekonstruksi — bila ditandai, ia lolos dari butir 8.
		for _, p := range h.payments.saved["trx-v2-1"] {
			if p.IsReconstructed {
				t.Errorf("tender %s dari perangkat ditandai IsReconstructed", p.ID)
			}
		}
	})

	t.Run("kartu tanpa trace number DITOLAK dan dikarantina", func(t *testing.T) {
		h := newContractHarness()

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"transactions": [{
				"id": "trx-bad-card",
				"shift_id": "shift-1",
				"total_amount": 100000,
				"payment_method": "DEBIT",
				"status": "COMPLETED",
				"client_created_at": "2026-08-20T10:00:00Z",
				"payments": [{"id":"pay-x","sequence":1,"method":"DEBIT","amount":100000}],
				"items": []
			}]
		}`)

		if res.TransactionsSynced != 0 {
			t.Fatal("transaksi kartu tanpa trace number seharusnya ditolak")
		}
		if len(res.Errors) != 1 {
			t.Fatalf("diharapkan tepat 1 galat, dapat %+v", res.Errors)
		}
		e := res.Errors[0]
		if e.Code != domain.ErrCodeCardDetailsRequired {
			t.Errorf("code = %q, diharapkan %q", e.Code, domain.ErrCodeCardDetailsRequired)
		}
		// Inti karantina: kegagalan ini TIDAK akan sembuh dengan mengirim ulang.
		if e.Retryable {
			t.Error("galat rincian kartu wajib retryable=false agar barisnya keluar dari antrean")
		}
		// Kompatibilitas v1: klien lama hanya membaca daftar ini.
		if len(res.FailedTransactions) != 1 || res.FailedTransactions[0] != "trx-bad-card" {
			t.Errorf("failed_transactions = %v, diharapkan berisi trx-bad-card", res.FailedTransactions)
		}
	})

	t.Run("jumlah tender tidak seimbang DITOLAK", func(t *testing.T) {
		h := newContractHarness()

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"transactions": [{
				"id": "trx-mismatch",
				"shift_id": "shift-1",
				"total_amount": 155000,
				"payment_method": "SPLIT",
				"status": "COMPLETED",
				"client_created_at": "2026-08-20T10:00:00Z",
				"payments": [
					{"id":"p1","sequence":1,"method":"CASH","amount":55000},
					{"id":"p2","sequence":2,"method":"QRIS","amount":50000}
				],
				"items": []
			}]
		}`)

		if res.TransactionsSynced != 0 {
			t.Fatal("transaksi dengan tender tidak seimbang seharusnya ditolak")
		}
		if len(res.Errors) != 1 || res.Errors[0].Code != domain.ErrCodeTenderMismatch {
			t.Fatalf("diharapkan TENDER_MISMATCH, dapat %+v", res.Errors)
		}
		if res.Errors[0].Retryable {
			t.Error("tender tidak seimbang wajib retryable=false")
		}
	})

	t.Run("retur melebihi kuantitas asal DITOLAK", func(t *testing.T) {
		h := newContractHarness()

		// Transaksi asal: 2 unit, struk sudah terbit.
		h.seedPrintedTransaction("trx-orig", map[string]int{"item-1": 2})
		// Satu unit sudah diretur sebelumnya → sisa 1, diminta 2.
		h.returns.returned["item-1"] = 1

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"returns": [{
				"id": "ret-1",
				"original_transaction_id": "trx-orig",
				"shift_id": "shift-2",
				"staff_id": "staff-1",
				"return_type": "PARTIAL",
				"refund_method": "CASH",
				"refund_amount": 55000,
				"reason_code": "DEFECTIVE",
				"client_created_at": "2026-08-21T09:00:00Z",
				"items": [{"id":"ri-1","transaction_item_id":"item-1","product_id":"prod-1",
				           "quantity":2,"unit_price":27500,"restock":true}]
			}]
		}`)

		if res.ReturnsSynced != 0 {
			t.Fatal("retur yang melebihi sisa kuantitas seharusnya ditolak")
		}
		if len(res.Errors) != 1 || res.Errors[0].Code != domain.ErrCodeReturnExceeds {
			t.Fatalf("diharapkan RETURN_EXCEEDS_ORIGINAL, dapat %+v", res.Errors)
		}
	})

	t.Run("retur dalam sisa kuantitas DITERIMA", func(t *testing.T) {
		h := newContractHarness()
		h.seedPrintedTransaction("trx-orig", map[string]int{"item-1": 2})

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"returns": [{
				"id": "ret-ok",
				"original_transaction_id": "trx-orig",
				"shift_id": "shift-2",
				"staff_id": "staff-1",
				"return_type": "PARTIAL",
				"refund_method": "CASH",
				"refund_amount": 27500,
				"reason_code": "DEFECTIVE",
				"client_created_at": "2026-08-21T09:00:00Z",
				"items": [{"id":"ri-1","transaction_item_id":"item-1","product_id":"prod-1",
				           "quantity":1,"unit_price":27500,"restock":true}]
			}]
		}`)

		if res.ReturnsSynced != 1 {
			t.Fatalf("retur sah ditolak: %+v", res.Errors)
		}
		saved := h.returns.saved["ret-ok"]
		if saved == nil {
			t.Fatal("retur tidak tersimpan")
		}
		// Retur dapat terjadi pada shift yang BERBEDA dari transaksi asal —
		// pelanggan yang kembali besok adalah kasus ritel normal.
		if saved.ShiftID != "shift-2" {
			t.Errorf("shift_id = %q, diharapkan shift-2 (shift saat retur)", saved.ShiftID)
		}

		// 1 dari 2 unit → PARTIAL, dihitung SERVER dan dituliskan kembali ke
		// transaksi asal ([11 §M13.6]).
		if got := h.returns.returnState["trx-orig"]; got != domain.ReturnStatePartial {
			t.Errorf("return_state = %q, diharapkan PARTIAL", got)
		}

		// `restock: true` → bahan baku kembali. Resepnya 1 rm-1 per unit,
		// sehingga 1 unit retur mengembalikan 1 satuan dari stok awal 100.
		if got := h.rawMaterials.rms["rm-1"].Stock; got != 101 {
			t.Errorf("stok rm-1 = %v, diharapkan 101 (kembali 1 satuan)", got)
		}
		if len(h.posRepo.wastes) != 0 {
			t.Errorf("restock=true tidak boleh menulis product_wastes, dapat %d", len(h.posRepo.wastes))
		}
	})

	t.Run("retur habis menandai FULL", func(t *testing.T) {
		h := newContractHarness()
		h.seedPrintedTransaction("trx-full", map[string]int{"item-1": 2})

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"returns": [{
				"id": "ret-full",
				"original_transaction_id": "trx-full",
				"shift_id": "shift-2",
				"staff_id": "staff-1",
				"return_type": "FULL",
				"refund_method": "CASH",
				"refund_amount": 55000,
				"reason_code": "DEFECTIVE",
				"client_created_at": "2026-08-21T09:00:00Z",
				"items": [{"id":"ri-1","transaction_item_id":"item-1","product_id":"prod-1",
				           "quantity":2,"unit_price":27500,"restock":true}]
			}]
		}`)

		if res.ReturnsSynced != 1 {
			t.Fatalf("retur penuh ditolak: %+v", res.Errors)
		}
		if got := h.returns.returnState["trx-full"]; got != domain.ReturnStateFull {
			t.Errorf("return_state = %q, diharapkan FULL", got)
		}
	})

	t.Run("restock=false menulis product_wastes dan TIDAK menambah stok", func(t *testing.T) {
		// Inti butir 15: arah uang dan arah barang dapat berbeda.
		h := newContractHarness()
		h.seedPrintedTransaction("trx-waste", map[string]int{"item-1": 2})

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"returns": [{
				"id": "ret-waste",
				"original_transaction_id": "trx-waste",
				"shift_id": "shift-2",
				"staff_id": "staff-1",
				"return_type": "PARTIAL",
				"refund_method": "CASH",
				"refund_amount": 27500,
				"reason_code": "DEFECTIVE",
				"client_created_at": "2026-08-21T09:00:00Z",
				"items": [{"id":"ri-1","transaction_item_id":"item-1","product_id":"prod-1",
				           "quantity":1,"unit_price":27500,"restock":false,
				           "waste_reason_code":"BROKEN"}]
			}]
		}`)

		if res.ReturnsSynced != 1 {
			t.Fatalf("retur ditolak: %+v", res.Errors)
		}

		// Stok TIDAK bertambah: barangnya rusak dan tidak pernah kembali ke rak.
		if got := h.rawMaterials.rms["rm-1"].Stock; got != 100 {
			t.Errorf("stok rm-1 = %v, diharapkan tetap 100", got)
		}

		// ...dan TIDAK berkurang lagi. Barangnya sudah terpotong saat penjualan;
		// memotongnya sekali lagi menghitung barang yang sama dua kali.
		if len(h.posRepo.wastes) != 1 {
			t.Fatalf("diharapkan 1 baris product_wastes, dapat %d", len(h.posRepo.wastes))
		}
		for _, w := range h.posRepo.wastes {
			if w.ReasonCode != "BROKEN" {
				t.Errorf("reason_code = %q, diharapkan BROKEN (dari waste_reason_code retur)", w.ReasonCode)
			}
			if w.Quantity != 1 {
				t.Errorf("quantity = %d, diharapkan 1", w.Quantity)
			}
			if w.ID == "" {
				t.Error("baris waste turunan wajib ber-UUID buatan server")
			}
		}
	})

	t.Run("item tidak dikembalikan ke stok wajib beralasan", func(t *testing.T) {
		h := newContractHarness()
		h.seedPrintedTransaction("trx-orig", map[string]int{"item-1": 2})

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"returns": [{
				"id": "ret-nowaste",
				"original_transaction_id": "trx-orig",
				"shift_id": "shift-2",
				"staff_id": "staff-1",
				"return_type": "PARTIAL",
				"refund_method": "CASH",
				"refund_amount": 27500,
				"reason_code": "DEFECTIVE",
				"client_created_at": "2026-08-21T09:00:00Z",
				"items": [{"id":"ri-1","transaction_item_id":"item-1","product_id":"prod-1",
				           "quantity":1,"unit_price":27500,"restock":false}]
			}]
		}`)

		// Tanpa alasan pembuangan, selisih stok muncul saat opname tanpa
		// penjelasan apa pun — dan tertuduhnya adalah petugas gudang.
		if res.ReturnsSynced != 0 || len(res.Errors) != 1 {
			t.Fatalf("retur restock=false tanpa alasan seharusnya ditolak, dapat %+v", res.Errors)
		}
	})

	t.Run("peristiwa keamanan dinormalkan, bukan ditolak", func(t *testing.T) {
		h := newContractHarness()

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"security_events": [{
				"id": "sec-odd",
				"event_type": "KIOSK_EXIT_DENIED",
				"severity": "MAHA_PENTING",
				"client_created_at": "2026-08-20T10:00:00Z"
			}]
		}`)

		if res.SecurityEventsSynced != 1 {
			t.Fatalf("peristiwa keamanan seharusnya diterima setelah dinormalkan: %+v", res.Errors)
		}
		got := h.events.saved["sec-odd"]
		if got.Severity != domain.SeverityInfo {
			t.Errorf("severity = %q, diharapkan dinormalkan ke INFO", got.Severity)
		}
		if string(got.Details) != "{}" {
			t.Errorf("details = %q, diharapkan objek kosong", string(got.Details))
		}
	})

	t.Run("void transaksi yang struknya sudah tercetak DITOLAK", func(t *testing.T) {
		// Inti butir 15 pada lapisan kontrak.
		h := newContractHarness()
		printed := time.Date(2026, 8, 20, 10, 14, 22, 0, time.UTC)
		h.posRepo.transactions["trx-printed"] = &domain.Transaction{
			ID:               "trx-printed",
			Status:           domain.TxStatusCompleted,
			ReceiptPrintedAt: &printed,
		}

		res := h.post(t, domain.ContractVersionV2, `{
			"device_id": "dev-01",
			"transactions": [{
				"id": "trx-printed",
				"shift_id": "shift-1",
				"total_amount": 55000,
				"payment_method": "CASH",
				"status": "VOIDED",
				"client_created_at": "2026-08-20T10:00:00Z",
				"items": []
			}]
		}`)

		if res.TransactionsSynced != 0 {
			t.Fatal("void atas transaksi yang struknya sudah terbit seharusnya ditolak")
		}
		if len(res.Errors) != 1 || res.Errors[0].Code != domain.ErrCodeVoidAfterPrint {
			t.Fatalf("diharapkan VOID_AFTER_PRINT, dapat %+v", res.Errors)
		}
	})
}

/* ── Master data ──────────────────────────────────────────────────────────── */

func TestMasterDataContractV2(t *testing.T) {
	h := newContractHarness()

	req := httptest.NewRequest(http.MethodGet, "/v1/pos/sync/master-data", nil)
	rr := httptest.NewRecorder()
	h.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("diharapkan 200, dapat %d", rr.Code)
	}

	body := rr.Body.String()

	// ATURAN R3 — stok sistem TIDAK BOLEH hadir di payload perangkat. Diperiksa
	// pada BODY MENTAH, bukan pada struct hasil parse: struct yang tidak punya
	// field-nya akan selalu lolos, sehingga uji semacam itu tidak membuktikan
	// apa pun tentang byte yang benar-benar dikirim.
	for _, forbidden := range []string{`"stock"`, `"system_stock"`, `"cost_per_unit"`, `"recipes"`} {
		if bytes.Contains([]byte(body), []byte(forbidden)) {
			t.Errorf("master data membocorkan %s — butir 3 gugur seketika bila stok sampai ke perangkat", forbidden)
		}
	}

	var envelope struct {
		Data *domain.SyncMasterDataResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("gagal mengurai: %v", err)
	}
	if envelope.Data.Version != 187 {
		t.Errorf("version = %d, diharapkan 187", envelope.Data.Version)
	}
	if envelope.Data.Config.VoidThresholdQty != 5 {
		t.Errorf("void_threshold_qty = %d, diharapkan 5", envelope.Data.Config.VoidThresholdQty)
	}
	if !envelope.Data.Config.BlindCloseEnabled || !envelope.Data.Config.BlindOpnameEnabled {
		t.Error("blind close/opname wajib aktif secara bawaan — kebijakan longgar berarti outlet berjalan tanpa pengendalian")
	}
}

/* ── Aturan R4 ────────────────────────────────────────────────────────────── */

// TestShiftExpectedNeverAcceptedFromClient menegakkan aturan R4.
func TestShiftExpectedNeverAcceptedFromClient(t *testing.T) {
	h := newContractHarness()

	h.post(t, domain.ContractVersionV2, `{
		"device_id": "dev-01",
		"shifts": [{
			"id": "shift-r4",
			"staff_id": "staff-1",
			"opening_balance": 500000,
			"declared_cash": 1750000,
			"declared_edc_total": 900000,
			"blind_close": true,
			"status": "CLOSED",
			"client_opened_at": "2026-08-20T08:00:00Z",
			"client_closed_at": "2026-08-20T16:00:00Z",
			"expected_cash": 1,
			"cash_variance": 999999
		}]
	}`)

	saved := h.posRepo.shifts["shift-r4"]
	if saved == nil {
		t.Fatal("shift tidak tersimpan")
	}
	// Klien yang dimodifikasi tidak boleh menentukan selisih kasnya sendiri.
	if saved.ExpectedCash != nil {
		t.Errorf("expected_cash dari klien diterima (%v) — aturan R4 dilanggar", *saved.ExpectedCash)
	}
	if saved.CashVariance != nil {
		t.Errorf("cash_variance dari klien diterima (%v) — aturan R4 dilanggar", *saved.CashVariance)
	}
	// Yang BOLEH datang dari kasir tetap tersimpan apa adanya.
	if saved.DeclaredCash != 1750000 {
		t.Errorf("declared_cash = %v, diharapkan 1750000", saved.DeclaredCash)
	}
	if !saved.BlindClose {
		t.Error("blind_close hilang")
	}
}

/* ── Endpoint returnable ([11 §4.5]) ──────────────────────────────────────── */

func TestReturnableEndpoint(t *testing.T) {
	get := func(t *testing.T, h *contractHarness, id string) (int, *domain.ReturnableResponse) {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/v1/pos/transactions/"+id+"/returnable", nil)
		rr := httptest.NewRecorder()
		h.mux.ServeHTTP(rr, req)

		var envelope struct {
			Data *domain.ReturnableResponse `json:"data"`
		}
		_ = json.Unmarshal(rr.Body.Bytes(), &envelope)
		return rr.Code, envelope.Data
	}

	t.Run("melaporkan sisa per baris", func(t *testing.T) {
		h := newContractHarness()
		h.seedPrintedTransaction("trx-1", map[string]int{"item-1": 3})
		h.returns.returned["item-1"] = 1
		h.posRepo.transactions["trx-1"].OutletID = "out-1"

		code, body := get(t, h, "trx-1")
		if code != http.StatusOK {
			t.Fatalf("diharapkan 200, dapat %d", code)
		}
		if !body.Eligible {
			t.Fatalf("diharapkan eligible, alasan: %q", body.Reason)
		}
		if len(body.Items) != 1 {
			t.Fatalf("diharapkan 1 item, dapat %d", len(body.Items))
		}
		item := body.Items[0]
		if item.OriginalQuantity != 3 || item.AlreadyReturned != 1 || item.Returnable != 2 {
			t.Errorf("sisa salah: asal=%d diretur=%d sisa=%d (diharapkan 3/1/2)",
				item.OriginalQuantity, item.AlreadyReturned, item.Returnable)
		}
		if body.ReturnState != domain.ReturnStatePartial {
			t.Errorf("return_state = %q, diharapkan PARTIAL", body.ReturnState)
		}
	})

	t.Run("transaksi belum tercetak TIDAK eligible", func(t *testing.T) {
		// Alasannya dinyatakan apa adanya, bukan dengan daftar kosong yang
		// memaksa klien menebak.
		h := newContractHarness()
		h.seedPrintedTransaction("trx-unprinted", map[string]int{"item-1": 2})
		h.posRepo.transactions["trx-unprinted"].OutletID = "out-1"
		h.posRepo.transactions["trx-unprinted"].ReceiptPrintedAt = nil

		code, body := get(t, h, "trx-unprinted")
		if code != http.StatusOK {
			t.Fatalf("diharapkan 200, dapat %d", code)
		}
		if body.Eligible {
			t.Fatal("transaksi belum tercetak seharusnya tidak eligible")
		}
		if body.Reason == "" {
			t.Error("alasan wajib dinyatakan")
		}
	})

	t.Run("habis diretur TIDAK eligible", func(t *testing.T) {
		h := newContractHarness()
		h.seedPrintedTransaction("trx-done", map[string]int{"item-1": 2})
		h.returns.returned["item-1"] = 2
		h.posRepo.transactions["trx-done"].OutletID = "out-1"

		_, body := get(t, h, "trx-done")
		if body.Eligible {
			t.Fatal("transaksi yang habis diretur seharusnya tidak eligible")
		}
		if body.ReturnState != domain.ReturnStateFull {
			t.Errorf("return_state = %q, diharapkan FULL", body.ReturnState)
		}
	})

	t.Run("transaksi outlet lain menjawab 404, bukan 403", func(t *testing.T) {
		// Membedakan "tidak ada" dari "bukan milik Anda" membocorkan keberadaan
		// transaksi outlet lain kepada siapa pun yang menebak UUID.
		h := newContractHarness()
		h.seedPrintedTransaction("trx-lain", map[string]int{"item-1": 1})
		h.posRepo.transactions["trx-lain"].OutletID = "out-999"

		code, _ := get(t, h, "trx-lain")
		if code != http.StatusNotFound {
			t.Fatalf("diharapkan 404, dapat %d", code)
		}
	})

	t.Run("transaksi tidak dikenal menjawab 404", func(t *testing.T) {
		h := newContractHarness()
		code, _ := get(t, h, "trx-hantu")
		if code != http.StatusNotFound {
			t.Fatalf("diharapkan 404, dapat %d", code)
		}
	})
}

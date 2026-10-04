package handler

import (
	"net/http"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/pkg/token"
)

func SetupRouter(
	businessHandler *BusinessHandler,
	outletHandler *OutletHandler,
	staffHandler *StaffHandler,
	rawMaterialHandler *RawMaterialHandler,
	productHandler *ProductHandler,
	wasteLogHandler *WasteLogHandler,
	restockLogHandler *RestockLogHandler,
	categoryHandler *ProductCategoryHandler,
	posAuthHandler *POSAuthHandler,
	posSyncHandler *POSSyncHandler,
	posReturnHandler *POSReturnHandler,
	reportHandler *ReportHandler,
	shiftReconcileHandler *ShiftReconcileHandler,
	opnameSessionHandler *OpnameSessionHandler,
	uploadHandler *UploadHandler,
	tokenMaker token.TokenMaker,
	auditRepo domain.AuditRepository,
	tenantManager *database.BusinessDBManager,
) *http.ServeMux {
	mux := http.NewServeMux()

	authMiddleware := middleware.AuthMiddleware(tokenMaker)
	deviceMiddleware := middleware.POSDeviceMiddleware(tokenMaker)
	auditMiddleware := middleware.AuditMiddleware(auditRepo)
	tenantMiddleware := middleware.BusinessMiddleware(tenantManager)
	
	// Helper to chain middlewares: Auth first, then Tenant, then Audit
	chain := func(handler http.HandlerFunc) http.HandlerFunc {
		return authMiddleware(tenantMiddleware(auditMiddleware(handler)))
	}
	deviceChain := func(handler http.HandlerFunc) http.HandlerFunc {
		return deviceMiddleware(tenantMiddleware(handler))
	}

	// ── BUTIR 4 — pemisahan tugas kasir vs gudang ([11 §M16.1]) ─────────────
	//
	// Dua rantai perangkat, dibedakan oleh klaim `scope` di dalam device token:
	//
	//   posDevice    → hanya perangkat KASIR
	//   opnameDevice → hanya perangkat GUDANG
	//
	// Ditegakkan di lapisan transport, bukan di UI. Menyembunyikan tombolnya
	// saja tidak cukup: siapa pun yang memegang device token dapat memanggil
	// endpoint-nya dengan `curl`, dan pemisahan tugas yang dapat dilewati
	// dengan satu perintah bukan pemisahan tugas.
	posDevice := func(handler http.HandlerFunc) http.HandlerFunc {
		return deviceChain(middleware.RequireDeviceScope(token.ScopePOS)(handler))
	}
	opnameDevice := func(handler http.HandlerFunc) http.HandlerFunc {
		return deviceChain(middleware.RequireDeviceScope(token.ScopeOpname)(handler))
	}

	// Business Routes
	mux.HandleFunc("POST /v1/auth/business/register", middleware.RateLimitRegistration(businessHandler.Register))
	mux.HandleFunc("POST /v1/auth/business/login", businessHandler.Login)
	mux.HandleFunc("POST /v1/auth/business/refresh", businessHandler.RefreshToken)
	mux.HandleFunc("GET /v1/auth/business/oauth/google", businessHandler.GoogleOAuthRedirect)
	mux.HandleFunc("GET /v1/auth/business/oauth/google/callback", businessHandler.GoogleOAuthCallback)
	
	// POS Device Routes
	mux.HandleFunc("POST /v1/auth/device/bind", posAuthHandler.BindDevice)
	// POS Sync Routes (Mobile / Cashier Device)
	//
	// `posDevice`, bukan `deviceMiddleware` telanjang: perangkat gudang yang
	// memanggil jalur ini mendapat `403 SCOPE_FORBIDDEN` (DoD M16 butir 2).
	//
	// `master-data` DIKECUALIKAN dengan sengaja — ia dipakai KEDUA jenis
	// perangkat. Petugas gudang membutuhkan katalog bahan baku dan daftar staff
	// untuk login offline, sama seperti kasir. Payloadnya sudah tidak memuat
	// stok maupun resep ([03 §2.2]), sehingga tidak ada yang bocor dengan
	// membukanya.
	// 
	// NOTE: deviceMiddleware is replaced with deviceChain to enforce multi-tenant isolation
	mux.HandleFunc("GET /v1/pos/sync/master-data", deviceChain(posSyncHandler.GetMasterData))
	mux.HandleFunc("POST /v1/pos/sync", posDevice(posSyncHandler.SyncUp))
	mux.HandleFunc("GET /v1/pos/transactions", posDevice(posSyncHandler.GetTransactions))
	// Sisa yang masih boleh diretur per baris ([11 §4.5], butir 15).
	//
	// Didaftarkan SEBELUM pola yang lebih umum tidak menjadi masalah di
	// `http.ServeMux` Go 1.22+: pencocokannya berbasis kekhususan pola, bukan
	// urutan pendaftaran.
	mux.HandleFunc("GET /v1/pos/transactions/{id}/returnable", posDevice(posReturnHandler.Returnable))

	// Butir 16 — satu-satunya jalan kasir menuju transaksi LAMPAU ([11 §M17.3]).
	//
	// Layar Riwayat hanya menampilkan shift berjalan; endpoint ini melayani
	// pencarian kode struk. Satu kode, satu transaksi — bukan daftar.
	mux.HandleFunc("GET /v1/pos/transactions/lookup", posDevice(posSyncHandler.LookupTransaction))

	// ── Modul SO — perangkat SO App (device token scope OPNAME) ─────────────
	//
	// Endpoint untuk app mobile SO (posgodinov-so). Kasir melihat form SO yang
	// tersedia, submit hitungan, dan lihat hitungan sendiri. Tidak ada endpoint
	// di sini yang mengembalikan system_stock — prinsip blind opname tetap.
	mux.HandleFunc("GET /v1/so/available", opnameDevice(opnameSessionHandler.ListAvailable))
	mux.HandleFunc("GET /v1/so/{form_id}", opnameDevice(opnameSessionHandler.GetFormForCounting))
	mux.HandleFunc("PUT /v1/so/{form_id}/counts", opnameDevice(opnameSessionHandler.SubmitCounts))
	mux.HandleFunc("GET /v1/so/{form_id}/my-counts", opnameDevice(opnameSessionHandler.GetMyCounts))
	mux.HandleFunc("GET /v1/so/sync/staff-data", opnameDevice(opnameSessionHandler.GetStaffData))
	
	// Reports Routes
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/dashboard", chain(reportHandler.GetDashboard))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/transactions", chain(reportHandler.GetTransactions))

	// Rekonsiliasi shift — butir 9 ([11 §M15.3]).
	//
	// ⚠️ Sengaja berada di bawah `chain` (autentikasi Business), BUKAN
	// `deviceMiddleware`. Ini satu-satunya endpoint yang mengeluarkan angka
	// `expected_*` dan `*_variance`, dan aturan R3 melarang angka itu mencapai
	// perangkat berperan kasir. Memindahkannya ke rute device akan membatalkan
	// seluruh Blind Closing dengan satu baris.
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/shift-reconciliation", chain(shiftReconcileHandler.List))

	// ── Modul SO — ADMIN (token bisnis) ─────────────────────────────────────
	//
	// Admin membuat form SO, pilih material, publish, tutup, approve/reject.
	// Di sinilah angka selisih dan system_stock boleh terlihat (setelah close).
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms", chain(opnameSessionHandler.CreateForm))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/so/forms", chain(opnameSessionHandler.ListForms))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/so/forms/{form_id}", chain(opnameSessionHandler.GetFormDetail))
	mux.HandleFunc("PUT /v1/business/outlets/{outlet_id}/so/forms/{form_id}/items", chain(opnameSessionHandler.UpdateFormItems))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/publish", chain(opnameSessionHandler.PublishForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/close", chain(opnameSessionHandler.CloseForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/approve", chain(opnameSessionHandler.ApproveForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/reject", chain(opnameSessionHandler.RejectForm))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/so/forms/{form_id}/recount", chain(opnameSessionHandler.RecountForm))

	// Protected Routes (Butuh Token)
	
	// Outlet Routes
	mux.HandleFunc("POST /v1/business/outlets", chain(outletHandler.Register))
	mux.HandleFunc("GET /v1/business/outlets", chain(outletHandler.GetAll))
	
	// Staff Routes
	mux.HandleFunc("POST /v1/business/staff", chain(staffHandler.RegisterStaff))
	mux.HandleFunc("GET /v1/business/staff", chain(staffHandler.GetAllByBusiness))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/staff", chain(staffHandler.GetAll))
	mux.HandleFunc("PUT /v1/business/staff/{staff_id}", chain(staffHandler.Update))
	mux.HandleFunc("POST /v1/business/staff/{staff_id}/transfer", chain(staffHandler.Transfer))
	mux.HandleFunc("DELETE /v1/business/staff/{staff_id}", chain(staffHandler.Delete))
	
	// Raw Material Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials", chain(rawMaterialHandler.Create))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/bulk", chain(rawMaterialHandler.CreateBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/raw-materials", chain(rawMaterialHandler.GetAll))
	mux.HandleFunc("PUT /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}", chain(rawMaterialHandler.Update))
	mux.HandleFunc("DELETE /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}", chain(rawMaterialHandler.Delete))

	// Product Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/products", chain(productHandler.Create))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/products/bulk", chain(productHandler.CreateBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/products", chain(productHandler.GetAll))
	mux.HandleFunc("PUT /v1/business/outlets/{outlet_id}/products/{product_id}", chain(productHandler.Update))
	mux.HandleFunc("DELETE /v1/business/outlets/{outlet_id}/products/{product_id}", chain(productHandler.Delete))
	
	// Waste Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/waste", chain(wasteLogHandler.Record))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/waste/bulk", chain(wasteLogHandler.RecordBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/waste", chain(wasteLogHandler.GetAll))
	

	// Restock Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/restock", chain(restockLogHandler.Record))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/restock/bulk", chain(restockLogHandler.RecordBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/restock", chain(restockLogHandler.GetAll))
	
	// Category Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/categories", chain(categoryHandler.Create))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/categories/bulk", chain(categoryHandler.CreateBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/categories", chain(categoryHandler.GetAll))
	
	// Upload Routes (Cloudinary Signed Upload)
	mux.HandleFunc("POST /v1/business/uploads/signature", chain(uploadHandler.GetUploadSignature))

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	return mux
}

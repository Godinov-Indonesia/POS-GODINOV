package handler

import (
	"net/http"

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
	stockOpnameHandler *StockOpnameHandler,
	restockLogHandler *RestockLogHandler,
	categoryHandler *ProductCategoryHandler,
	posAuthHandler *POSAuthHandler,
	posSyncHandler *POSSyncHandler,
	reportHandler *ReportHandler,
	tokenMaker token.TokenMaker,
	auditRepo domain.AuditRepository,
) *http.ServeMux {
	mux := http.NewServeMux()

	authMiddleware := middleware.AuthMiddleware(tokenMaker)
	deviceMiddleware := middleware.POSDeviceMiddleware(tokenMaker)
	auditMiddleware := middleware.AuditMiddleware(auditRepo)
	
	// Helper to chain middlewares: Auth first, so Audit can read the Token Payload from context
	chain := func(handler http.HandlerFunc) http.HandlerFunc {
		return authMiddleware(auditMiddleware(handler))
	}

	// Business Routes
	mux.HandleFunc("POST /v1/auth/business/register", middleware.RateLimitRegistration(businessHandler.Register))
	mux.HandleFunc("POST /v1/auth/business/login", businessHandler.Login)
	mux.HandleFunc("POST /v1/auth/business/refresh", businessHandler.RefreshToken)
	
	// POS Device Routes
	mux.HandleFunc("POST /v1/auth/device/bind", posAuthHandler.BindDevice)
	// POS Sync Routes (Mobile / Cashier Device)
	mux.HandleFunc("GET /v1/pos/sync/master-data", deviceMiddleware(posSyncHandler.GetMasterData))
	mux.HandleFunc("POST /v1/pos/sync", deviceMiddleware(posSyncHandler.SyncUp))
	mux.HandleFunc("GET /v1/pos/transactions", deviceMiddleware(posSyncHandler.GetTransactions))
	
	// Reports Routes
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/dashboard", chain(reportHandler.GetDashboard))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/transactions", chain(reportHandler.GetTransactions))

	// Protected Routes (Butuh Token)
	
	// Outlet Routes
	mux.HandleFunc("POST /v1/business/outlets", chain(outletHandler.Register))
	mux.HandleFunc("GET /v1/business/outlets", chain(outletHandler.GetAll))
	
	// Staff Routes
	mux.HandleFunc("POST /v1/business/staff", chain(staffHandler.RegisterStaff))
	mux.HandleFunc("GET /v1/business/staff", chain(staffHandler.GetAllByBusiness))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/staff", chain(staffHandler.GetAll))
	mux.HandleFunc("PUT /v1/business/staff/{staff_id}", chain(staffHandler.Update))
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
	
	// Stock Opname Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/opnames", chain(stockOpnameHandler.Record))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/opnames/bulk", chain(stockOpnameHandler.RecordBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/opnames", chain(stockOpnameHandler.GetAll))
	
	// Restock Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/restock", chain(restockLogHandler.Record))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/restock/bulk", chain(restockLogHandler.RecordBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/reports/restock", chain(restockLogHandler.GetAll))
	
	// Category Routes
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/categories", chain(categoryHandler.Create))
	mux.HandleFunc("POST /v1/business/outlets/{outlet_id}/categories/bulk", chain(categoryHandler.CreateBulk))
	mux.HandleFunc("GET /v1/business/outlets/{outlet_id}/categories", chain(categoryHandler.GetAll))
	
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	return mux
}

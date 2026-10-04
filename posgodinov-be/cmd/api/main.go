package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/handler"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/repository"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/token"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Terapkan Log Level dari Environment
	logger.SetupLogger(cfg.LogLevel)

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	sqlDB, err := db.DB()
	if err != nil {
		logger.Error("failed to get sql.DB", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	// Run Database Migrations
	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		logger.Error("failed to create migrate driver", "error", err)
		os.Exit(1)
	}
	m, err := migrate.NewWithDatabaseInstance(
		"file://db/migrations/landlord",
		"postgres", driver)
	if err != nil {
		logger.Error("failed to init migrate", "error", err)
		os.Exit(1)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		logger.Error("failed to run migrate up", "error", err)
		os.Exit(1)
	}
	logger.Info("database migrated successfully")

	// Setup PASETO Token Maker
	tokenMaker, err := token.NewPasetoMaker(cfg.PasetoSymmetricKey)
	if err != nil {
		logger.Error("failed to create token maker", "error", err)
		os.Exit(1)
	}

	// Setup Repositories
	businessRepo := repository.NewBusinessRepository(db)
	outletRepo := repository.NewOutletRepository(db)
	staffRepo := repository.NewStaffRepository(db)
	rawMaterialRepo := repository.NewRawMaterialRepository(db)
	productRepo := repository.NewProductRepository(db)
	wasteLogRepo := repository.NewWasteLogRepository(db)
	restockLogRepo := repository.NewRestockLogRepository(db)
	categoryRepo := repository.NewProductCategoryRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	txManager := database.NewTransactionManager(db)
	businessManager := database.NewBusinessDBManager(cfg, db)

	posRepo := repository.NewPOSRepository(db)
	reportRepo := repository.NewReportRepository(db)

	// Repositori v2 — Fase M11.2 ([11 §4.7])
	paymentRepo := repository.NewTransactionPaymentRepository(db)
	returnRepo := repository.NewReturnRepository(db)
	voidLogRepo := repository.NewVoidLogRepository(db)
	securityEventRepo := repository.NewSecurityEventRepository(db)
	masterVersionRepo := repository.NewMasterVersionRepository(db)

	// Repositori v2 — Fase M15.3 ([11 §4.7])
	shiftReconcileRepo := repository.NewShiftReconcileRepository(db)

	// Repositori v2 — Fase M16.3 ([11 §4.7])
	opnameSessionRepo := repository.NewOpnameSessionRepository(db)

	// Repositori SaaS & Landlord Platform
	landlordRepo := repository.NewLandlordRepository(db)
	saasRepo := repository.NewSaaSRepository(db)
	policyEngine := service.NewPolicyEngine(saasRepo)

	// Setup Services
	businessSvc := service.NewBusinessService(businessRepo, tokenMaker, txManager, businessManager,
		cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL,
		service.WithSaaSRepository(saasRepo))
	outletSvc := service.NewOutletService(outletRepo, businessRepo, txManager,
		service.WithOutletPolicyEngine(policyEngine))
	staffSvc := service.NewStaffService(staffRepo, outletRepo,
		service.WithStaffMasterVersion(txManager, masterVersionRepo),
		service.WithStaffPolicyEngine(policyEngine))
	rawMaterialSvc := service.NewRawMaterialService(rawMaterialRepo, outletRepo,
		service.WithRawMaterialPolicyEngine(policyEngine))
	productSvc := service.NewProductService(productRepo, rawMaterialRepo, outletRepo, txManager,
		service.WithProductMasterVersion(masterVersionRepo),
		service.WithProductPolicyEngine(policyEngine))
	wasteLogSvc := service.NewWasteLogService(wasteLogRepo, rawMaterialRepo, outletRepo, txManager)
	restockLogSvc := service.NewRestockLogService(restockLogRepo, rawMaterialRepo, outletRepo, txManager)
	categorySvc := service.NewProductCategoryService(categoryRepo, outletRepo,
		service.WithCategoryMasterVersion(txManager, masterVersionRepo))
	landlordSvc := service.NewLandlordService(landlordRepo, saasRepo, businessRepo, tokenMaker, policyEngine)
	posAuthSvc := service.NewPOSAuthService(businessRepo, outletRepo, tokenMaker, businessManager)
	// Aturan retur hidup di layanannya sendiri ([11 §M13.6]) dan dipakai DUA
	// pemanggil: jalur sinkronisasi dan endpoint `returnable`. Satu instance
	// untuk keduanya memastikan tidak ada versi aturan yang menyimpang.
	returnSvc := service.NewReturnService(
		returnRepo, posRepo, productRepo, rawMaterialRepo, txManager,
	)

	// Rekonsiliasi shift hidup di layanannya sendiri ([11 §M15.3]): angka
	// ekspektasi dan selisih dihitung SERVER, tidak pernah diterima dari
	// perangkat kasir (aturan R3/R4).
	shiftReconcileSvc := service.NewShiftReconcileService(posRepo, shiftReconcileRepo)

	// Modul Stock Opname (SO) — admin-managed form flow.
	// Admin buat form → publish → kasir submit → admin close → approve/reject.
	opnameSessionSvc := service.NewOpnameSessionService(
		opnameSessionRepo, rawMaterialRepo, outletRepo, txManager,
		service.WithSOStaffRepository(staffRepo),
	)

	posSyncSvc := service.NewPOSSyncService(
		staffRepo, categoryRepo, productRepo, posRepo, rawMaterialRepo, txManager,
		service.WithPaymentRepository(paymentRepo),
		service.WithReturnService(returnSvc),
		service.WithVoidLogRepository(voidLogRepo),
		service.WithSecurityEventRepository(securityEventRepo),
		service.WithMasterVersionRepository(masterVersionRepo),
		service.WithShiftReconcileService(shiftReconcileSvc),
	)
	reportSvc := service.NewReportService(reportRepo, service.WithReportPolicyEngine(policyEngine))

	// Setup Handlers
	businessHandler := handler.NewBusinessHandler(businessSvc)
	outletHandler := handler.NewOutletHandler(outletSvc)
	staffHandler := handler.NewStaffHandler(staffSvc)
	rawMaterialHandler := handler.NewRawMaterialHandler(rawMaterialSvc)
	productHandler := handler.NewProductHandler(productSvc)
	wasteLogHandler := handler.NewWasteLogHandler(wasteLogSvc)
	restockLogHandler := handler.NewRestockLogHandler(restockLogSvc)
	categoryHandler := handler.NewProductCategoryHandler(categorySvc)
	posAuthHandler := handler.NewPOSAuthHandler(posAuthSvc)
	posSyncHandler := handler.NewPOSSyncHandler(posSyncSvc)
	posReturnHandler := handler.NewPOSReturnHandler(returnSvc)
	reportHandler := handler.NewReportHandler(reportSvc)
	shiftReconcileHandler := handler.NewShiftReconcileHandler(shiftReconcileSvc)
	opnameSessionHandler := handler.NewOpnameSessionHandler(opnameSessionSvc)
	uploadSvc := service.NewUploadService(cfg)
	uploadHandler := handler.NewUploadHandler(uploadSvc)
	landlordHandler := handler.NewLandlordHandler(landlordSvc)

	// Setup Router
	mux := handler.SetupRouter(
		businessHandler,
		outletHandler,
		staffHandler,
		rawMaterialHandler,
		productHandler,
		wasteLogHandler,
		restockLogHandler,
		categoryHandler,
		posAuthHandler,
		posSyncHandler,
		posReturnHandler,
		reportHandler,
		shiftReconcileHandler,
		opnameSessionHandler,
		uploadHandler,
		landlordHandler,
		tokenMaker,
		auditRepo,
		businessManager,
	)

	// Apply Middlewares (Recovery, CORS, Security Headers, and Logger)
	var handlerToServe http.Handler = mux
	handlerToServe = middleware.PanicRecovery(cfg.AppEnv)(handlerToServe)
	handlerToServe = middleware.SecurityHeaders(handlerToServe)
	handlerToServe = middleware.SetupCORS(cfg.AppEnv, cfg.AllowedOrigins).Handler(handlerToServe)
	handlerToServe = middleware.RequestLogger(handlerToServe)

	srv := &http.Server{
		Addr:    ":" + cfg.AppPort,
		Handler: handlerToServe,
	}

	// Graceful shutdown setup
	idleConnsClosed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt)
		<-sigint

		logger.Info("Shutting down server...")

		ctx, cancel := context.WithTimeoutCause(context.Background(), 10*time.Second, nil)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			logger.Error("HTTP server Shutdown error", "error", err)
		}
		close(idleConnsClosed)
	}()

	logger.Info("Server listening", "port", cfg.AppPort)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		logger.Error("HTTP server ListenAndServe error", "error", err)
		os.Exit(1)
	}

	<-idleConnsClosed
	logger.Info("Server gracefully stopped")
}

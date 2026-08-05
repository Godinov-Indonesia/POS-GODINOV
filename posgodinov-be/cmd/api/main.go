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
		"file://db/migrations",
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
	stockOpnameRepo := repository.NewStockOpnameRepository(db)
	restockLogRepo := repository.NewRestockLogRepository(db)
	categoryRepo := repository.NewProductCategoryRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	txManager := database.NewTransactionManager(db)

	posRepo := repository.NewPOSRepository(db)
	reportRepo := repository.NewReportRepository(db)

	// Setup Services
	businessSvc := service.NewBusinessService(businessRepo, tokenMaker, txManager)
	outletSvc := service.NewOutletService(outletRepo, businessRepo, txManager)
	staffSvc := service.NewStaffService(staffRepo, outletRepo)
	rawMaterialSvc := service.NewRawMaterialService(rawMaterialRepo, outletRepo)
	productSvc := service.NewProductService(productRepo, rawMaterialRepo, outletRepo, txManager)
	wasteLogSvc := service.NewWasteLogService(wasteLogRepo, rawMaterialRepo, outletRepo, txManager)
	stockOpnameSvc := service.NewStockOpnameService(stockOpnameRepo, rawMaterialRepo, outletRepo, txManager)
	restockLogSvc := service.NewRestockLogService(restockLogRepo, rawMaterialRepo, outletRepo, txManager)
	categorySvc := service.NewProductCategoryService(categoryRepo, outletRepo)
	posAuthSvc := service.NewPOSAuthService(businessRepo, outletRepo, tokenMaker)
	posSyncSvc := service.NewPOSSyncService(staffRepo, categoryRepo, productRepo, posRepo, rawMaterialRepo, txManager)
	reportSvc := service.NewReportService(reportRepo)

	// Setup Handlers
	businessHandler := handler.NewBusinessHandler(businessSvc)
	outletHandler := handler.NewOutletHandler(outletSvc)
	staffHandler := handler.NewStaffHandler(staffSvc)
	rawMaterialHandler := handler.NewRawMaterialHandler(rawMaterialSvc)
	productHandler := handler.NewProductHandler(productSvc)
	wasteLogHandler := handler.NewWasteLogHandler(wasteLogSvc)
	stockOpnameHandler := handler.NewStockOpnameHandler(stockOpnameSvc)
	restockLogHandler := handler.NewRestockLogHandler(restockLogSvc)
	categoryHandler := handler.NewProductCategoryHandler(categorySvc)
	posAuthHandler := handler.NewPOSAuthHandler(posAuthSvc)
	posSyncHandler := handler.NewPOSSyncHandler(posSyncSvc)
	reportHandler := handler.NewReportHandler(reportSvc)

	// Setup Router
	mux := handler.SetupRouter(
		businessHandler, 
		outletHandler, 
		staffHandler, 
		rawMaterialHandler, 
		productHandler, 
		wasteLogHandler, 
		stockOpnameHandler, 
		restockLogHandler, 
		categoryHandler,
		posAuthHandler,
		posSyncHandler,
		reportHandler,
		tokenMaker, 
		auditRepo,
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

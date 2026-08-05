package main

import (
	"log"
	"os"

	"github.com/brianvoe/gofakeit/v7"
	"golang.org/x/crypto/bcrypt"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Gagal memuat config: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("Gagal koneksi ke database: %v", err)
	}

	gofakeit.Seed(0)
	log.Println("Memulai proses seeding (Business, Outlet, User)...")

	// 1. Buat Business
	hashedPass, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	business := domain.Business{
		ID:             utils.GenerateRandomString(8),
		SerialBusiness: "POSGO180726",
		Email:          "owner@posgodinov.com",
		Password:       string(hashedPass),
		Name:           "Godinov Group",
		OwnerName:      "Bapak Godinov",
	}

	if err := db.Create(&business).Error; err != nil {
		log.Fatalf("Gagal insert business: %v", err)
	}

	// 2. Buat Outlet
	outlet := domain.Outlet{
		ID:           utils.GenerateRandomString(6),
		BusinessID:   business.ID,
		SerialTenant: business.SerialBusiness + "001",
		Name:         "Godinov Pusat Jakarta",
		Address:      "Jl. Sudirman No. 1, Jakarta",
	}

	if err := db.Create(&outlet).Error; err != nil {
		log.Fatalf("Gagal insert outlet: %v", err)
	}

	// 3. Buat User (Kasir)
	var users []domain.Staff
	for i := 0; i < 3; i++ {
		hashedPin, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
		users = append(users, domain.Staff{
			OutletID:        outlet.ID,
			StaffIdentifier: gofakeit.Username(),
			Name:            gofakeit.Name(),
			PINHash:         string(hashedPin),
			Role:            "CASHIER",
			IsActive:        true,
		})
	}

	if err := db.Create(&users).Error; err != nil {
		log.Fatalf("Gagal insert users: %v", err)
	}

	log.Println("Seeding berhasil! (1 Business, 1 Outlet, 3 Users)")
	os.Exit(0)
}

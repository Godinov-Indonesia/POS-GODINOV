package config

import (
	"cmp"
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv         string
	AppPort        string
	AllowedOrigins string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName             string
	DBSSLMode          string
	LogLevel           string
	PasetoSymmetricKey string

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Cloudinary
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
	CloudinaryFolder    string

	// Landing Page Revalidation
	LandingPageRevalidateURL    string
	LandingPageRevalidateSecret string

	// Payment Hub Webhook
	PaymentWebhookSecret string

	// Database Backup & Restore
	BackupStoragePath        string
	BackupRetentionDays      int
	GDriveServiceAccountJSON string
	GDriveFolderID           string
	RestoreSource            string
}

func LoadConfig() (*Config, error) {
	// Load .env file if it exists, ignore error if it doesn't
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:         cmp.Or(os.Getenv("APP_ENV"), "local"),
		AppPort:        cmp.Or(os.Getenv("APP_PORT"), "8080"),
		AllowedOrigins: cmp.Or(os.Getenv("ALLOWED_ORIGINS"), "http://localhost:3000"),
		DBHost:     cmp.Or(os.Getenv("DB_HOST"), "localhost"),
		DBPort:     cmp.Or(os.Getenv("DB_PORT"), "5432"),
		DBUser:     cmp.Or(os.Getenv("DB_USER"), "posgodinov"),
		DBPassword: cmp.Or(os.Getenv("DB_PASSWORD"), "secret"),
		DBName:             cmp.Or(os.Getenv("DB_NAME"), "posgodinov"),
		DBSSLMode:          cmp.Or(os.Getenv("DB_SSLMODE"), "disable"),
		LogLevel:           cmp.Or(os.Getenv("LOG_LEVEL"), "info"),
		PasetoSymmetricKey: cmp.Or(os.Getenv("PASETO_SYMMETRIC_KEY"), "12345678901234567890123456789012"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),

		CloudinaryCloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret: os.Getenv("CLOUDINARY_API_SECRET"),
		CloudinaryFolder:    cmp.Or(os.Getenv("CLOUDINARY_FOLDER"), "posgodinov"),

		LandingPageRevalidateURL:    os.Getenv("LANDING_PAGE_REVALIDATE_URL"),
		LandingPageRevalidateSecret: os.Getenv("LANDING_PAGE_REVALIDATE_SECRET"),
		PaymentWebhookSecret:        os.Getenv("PAYMENT_WEBHOOK_SECRET"),

		BackupStoragePath:        cmp.Or(os.Getenv("BACKUP_STORAGE_PATH"), "./backups"),
		BackupRetentionDays:      30,
		GDriveServiceAccountJSON: os.Getenv("GDRIVE_SERVICE_ACCOUNT_JSON"),
		GDriveFolderID:           os.Getenv("GDRIVE_FOLDER_ID"),
		RestoreSource:            cmp.Or(os.Getenv("RESTORE_SOURCE"), "local"),
	}

	if cfg.AppEnv == "production" {
		if cfg.PasetoSymmetricKey == "12345678901234567890123456789012" || len(cfg.PasetoSymmetricKey) < 32 {
			return nil, errors.New("PASETO_SYMMETRIC_KEY wajib diatur minimal 32 byte dan bukan default di production")
		}
		if cfg.PaymentWebhookSecret == "" {
			return nil, errors.New("PAYMENT_WEBHOOK_SECRET wajib diatur di production")
		}
	}

	return cfg, nil
}

package config

import (
	"cmp"
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

	// Cloudinary
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
	CloudinaryFolder    string
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

		CloudinaryCloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret: os.Getenv("CLOUDINARY_API_SECRET"),
		CloudinaryFolder:    cmp.Or(os.Getenv("CLOUDINARY_FOLDER"), "posgodinov"),
	}

	return cfg, nil
}

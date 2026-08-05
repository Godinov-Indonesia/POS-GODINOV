package main

import (
	"log"
	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatal(err)
	}

	db.Exec("UPDATE schema_migrations SET version = 15, dirty = false")
	db.Exec("DROP TABLE IF EXISTS product_wastes, transaction_items, transactions, shifts;")
	log.Println("Fixed schema_migrations to version 15 and dropped pos tables")
}

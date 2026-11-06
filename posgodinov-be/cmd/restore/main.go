package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/internal/service/storage"
	"posgodinov-backend/pkg/logger"
)

func main() {
	sourceFlag := flag.String("source", "", "Sumber restore backup: 'local' atau 'gdrive'")
	pathFlag := flag.String("path", "", "Path direktori backup lokal jika memakai source=local")
	dbFlag := flag.String("db", "", "Nama database tertentu yang ingin dipulihkan saja (opsional)")
	dryRunFlag := flag.Bool("dry-run", false, "Simulasi discovery tanpa menyentuh database")
	flag.Parse()

	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error memuat konfigurasi .env: %v\n", err)
		os.Exit(1)
	}

	logger.SetupLogger(cfg.LogLevel)

	source := *sourceFlag
	if source == "" {
		source = cfg.RestoreSource
	}
	if source == "" {
		source = "local"
	}

	backupPath := *pathFlag
	if backupPath == "" {
		backupPath = cfg.BackupStoragePath
	}
	if backupPath == "" {
		backupPath = "./backups"
	}

	fmt.Println("==================================================================")
	fmt.Println("           POS-GODINOV DATABASE AUTO-RESTORE INJECTOR           ")
	fmt.Println("==================================================================")
	fmt.Printf(" [i] Source           : %s\n", strings.ToUpper(source))
	fmt.Printf(" [i] Local Path       : %s\n", backupPath)
	fmt.Printf(" [i] PostgreSQL Host  : %s:%s\n", cfg.DBHost, cfg.DBPort)
	fmt.Printf(" [i] PostgreSQL User  : %s\n", cfg.DBUser)
	if *dbFlag != "" {
		fmt.Printf(" [i] Target Specific  : %s\n", *dbFlag)
	} else {
		fmt.Printf(" [i] Target           : ALL DATABASES (Landlord + Tenants)\n")
	}
	if *dryRunFlag {
		fmt.Printf(" [!] MODE             : DRY-RUN (Simulasi)\n")
	}
	fmt.Println("==================================================================")

	localStore := storage.NewLocalStorageProvider(backupPath)
	var gdriveStore *storage.GoogleDriveStorageProvider
	if cfg.GDriveServiceAccountJSON != "" {
		var gErr error
		gdriveStore, gErr = storage.NewGoogleDriveStorageProvider(context.Background(), cfg.GDriveServiceAccountJSON, cfg.GDriveFolderID)
		if gErr != nil {
			fmt.Printf(" [!] Warning: Google Drive provider gagal diinisialisasi: %v\n", gErr)
		} else {
			fmt.Println(" [✓] Google Drive Storage Provider siap digunakan")
		}
	}

	restoreSvc := service.NewRestoreService(cfg, localStore, gdriveStore)

	opts := service.RestoreOptions{
		Source:     source,
		SpecificDB: *dbFlag,
		DryRun:     *dryRunFlag,
	}

	fmt.Println("\n Memulai proses auto-restore database...")
	report, err := restoreSvc.RunRestore(context.Background(), opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\n[✗] GAGAL: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n==================================================================")
	fmt.Println("                    RINGKASAN HASIL RESTORE                       ")
	fmt.Println("==================================================================")
	fmt.Printf(" [✓] Database Berhasil Dipulihkan : %d database\n", len(report.DatabasesRestored))
	for i, db := range report.DatabasesRestored {
		fmt.Printf("     %2d. %s\n", i+1, db)
	}
	fmt.Printf(" [✓] Total Ukuran SQL Terinjeksi : %.2f MB\n", float64(report.TotalSizeBytes)/(1024*1024))
	fmt.Printf(" [✓] Total Waktu Eksekusi        : %s\n", report.Duration.Round(time.Millisecond))

	if len(report.Errors) > 0 {
		fmt.Printf("\n [!] Peringatan / Error Terjadi (%d):\n", len(report.Errors))
		for _, e := range report.Errors {
			fmt.Printf("     - %s\n", e)
		}
	}
	fmt.Println("==================================================================")
	fmt.Println(" Status: Siap dijalankan dengan 'go run cmd/api/main.go'")
}

// Command seeder mengisi basis data dengan outlet-set yang menyerupai operasi
// nyata: master data, riwayat shift berhari-hari, transaksi dengan pembayaran
// majemuk, retur, void, pembuangan, restock, dan sesi opname.
//
// # Mengapa bukan sekadar "beberapa baris contoh"
//
// Layar yang paling sering salah justru yang hanya muncul setelah data punya
// SEJARAH: rekonsiliasi shift butuh tender yang benar-benar berjumlah, layar
// retur butuh transaksi yang masih menyisakan item, laporan pemilik butuh
// rentang tanggal. Seed berisi tiga baris membuat semua layar itu tampak
// "kosong tapi tidak error" — bentuk kegagalan yang paling mahal karena lolos
// dari QA dan baru terlihat di outlet.
//
// # Angka di sini mengikuti rumus server, bukan karangan
//
// Nilai expected_* dan *_variance pada shift dihitung dengan rumus yang sama
// persis dengan shiftReconcileService.Reconcile:
//
//	expected_cash = opening_balance + tender CASH   − refund CASH
//	expected_edc  =                   tender DEBIT+CREDIT − refund CARD_REVERSAL
//	expected_qris =                   tender QRIS   − refund QRIS_REVERSAL
//	variance      = declared − expected
//
// Hanya transaksi COMPLETED yang dihitung (VOIDED/CANCELLED tidak), dan refund
// dibebankan ke shift tempat returnya terjadi — bukan shift transaksi asalnya.
// Kalau rumusnya menyimpang, setiap shift hasil seed akan tampak selisih di
// dashboard dan QA akan mengejar bug yang tidak ada.
//
// Pemakaian:
//
//	go run ./cmd/seeder              # menolak jalan bila database sudah berisi
//	go run ./cmd/seeder -reset       # hapus data lama, isi ulang
//	go run ./cmd/seeder -reset -days 30
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"posgodinov-backend/internal/config"
	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/utils"
)

// ════════════════════════════════════════════════════════════════════════════
// Tetapan
// ════════════════════════════════════════════════════════════════════════════

const (
	businessID     = "GODINOV1"
	serialBusiness = "POSGO180726"
	ownerEmail     = "owner@posgodinov.com"
	ownerPassword  = "password123"
	staffPIN       = "123456"

	// Benih tetap. QA harus bisa mengulang temuan hari ini pada besok pagi
	// dengan data yang sama persis; benih acak membuat setiap laporan bug tidak
	// dapat direproduksi.
	rngSeed = 20260826

	varianceThreshold = 5000.0 // sama dengan service.VarianceThreshold
)

var wib = time.FixedZone("WIB", 7*60*60)

// dataTables adalah seluruh tabel yang dikosongkan oleh -reset, diurutkan dari
// anak ke induk. CASCADE sebetulnya membuat urutan tidak wajib, tetapi daftar
// yang urut membuat tabel yang lupa didaftarkan langsung terlihat.
//
// schema_migrations sengaja TIDAK ada di sini: mengosongkannya membuat
// golang-migrate menjalankan ulang seluruh migrasi pada startup berikutnya.
var dataTables = []string{
	"return_items", "returns",
	"transaction_payments", "transaction_items",
	"void_logs", "pos_security_events", "product_wastes",
	"transactions", "shifts",
	"opname_session_items", "opname_sessions",
	"stock_opnames", "waste_logs", "restock_logs",
	"product_recipes", "products", "product_categories", "raw_materials",
	"outlet_master_versions", "users", "outlets", "businesses",
	"audit_logs",
}

// ════════════════════════════════════════════════════════════════════════════
// Cetak biru
// ════════════════════════════════════════════════════════════════════════════

type staffBP struct {
	Identifier string
	Name       string
	Role       string
	Perms      domain.StringList
}

type outletBP struct {
	ID      string
	Serial  string
	Name    string
	Address string
	Devices []string
	Staff   []staffBP
}

type rawMaterialBP struct {
	Name        string
	Unit        string
	PackageUnit string // kosong berarti tidak dibeli per kemasan
	PerPackage  float64
	Stock       float64
	CostPerUnit float64
}

type productBP struct {
	Name     string
	Price    float64
	Category string
	Recipe   map[string]float64 // nama bahan baku -> jumlah per porsi
}

func outletBlueprints() []outletBP {
	full := domain.StringList{
		domain.PermissionVoidApprove, domain.PermissionReturnApprove,
		domain.PermissionKioskExit, domain.PermissionOpnameCount,
		domain.PermissionForceClose,
	}
	spv := domain.StringList{
		domain.PermissionVoidApprove, domain.PermissionReturnApprove,
		domain.PermissionKioskExit,
	}
	stok := domain.StringList{domain.PermissionOpnameCount}

	return []outletBP{
		{
			ID: "OUT001", Serial: serialBusiness + "001",
			Name:    "Godinov Pusat Jakarta",
			Address: "Jl. Jenderal Sudirman No. 1, Jakarta Pusat",
			Devices: []string{"TAB-JKT-01", "TAB-JKT-02"},
			Staff: []staffBP{
				{"manager01", "Rangga Wijaya", "MANAGER", full},
				{"spv01", "Dewi Lestari", "SUPERVISOR", spv},
				{"kasir01", "Bagus Prakoso", "CASHIER", domain.StringList{}},
				{"kasir02", "Siti Nurhaliza", "CASHIER", domain.StringList{}},
				{"kasir03", "Andi Saputra", "CASHIER", domain.StringList{}},
				{"stok01", "Yuni Rahmawati", "STOCK_KEEPER", stok},
			},
		},
		{
			ID: "OUT002", Serial: serialBusiness + "002",
			Name:    "Godinov Cabang Bandung",
			Address: "Jl. Braga No. 24, Bandung",
			Devices: []string{"TAB-BDG-01"},
			Staff: []staffBP{
				{"manager01", "Hendra Gunawan", "MANAGER", full},
				{"spv01", "Rina Marlina", "SUPERVISOR", spv},
				{"kasir01", "Fajar Ramadhan", "CASHIER", domain.StringList{}},
				{"kasir02", "Nadia Puspita", "CASHIER", domain.StringList{}},
				{"kasir03", "Yoga Pratama", "CASHIER", domain.StringList{}},
				{"stok01", "Tari Anggraini", "STOCK_KEEPER", stok},
			},
		},
	}
}

func categoryNames() []string {
	return []string{"Kopi", "Non-Kopi", "Makanan Berat", "Snack", "Dessert", "Paket Bundling"}
}

func rawMaterialBlueprints() []rawMaterialBP {
	return []rawMaterialBP{
		{"Biji Kopi Arabika", "gram", "karung", 1000, 24000, 220},
		{"Biji Kopi Robusta", "gram", "karung", 1000, 30000, 145},
		{"Susu UHT Full Cream", "ml", "kotak", 1000, 60000, 18},
		{"Susu Kental Manis", "gram", "kaleng", 370, 11100, 32},
		{"Gula Pasir", "gram", "karung", 1000, 40000, 15},
		{"Gula Aren Cair", "ml", "botol", 500, 15000, 46},
		{"Es Batu", "gram", "pack", 5000, 150000, 2},
		{"Cokelat Bubuk", "gram", "pack", 500, 10000, 95},
		{"Matcha Bubuk", "gram", "pack", 250, 5000, 380},
		{"Teh Hitam", "gram", "pack", 250, 5000, 120},
		{"Sirup Vanilla", "ml", "botol", 750, 9000, 58},
		{"Roti Tawar", "lembar", "bungkus", 10, 600, 1500},
		{"Telur Ayam", "butir", "tray", 30, 900, 2400},
		{"Daging Ayam Fillet", "gram", "pack", 500, 30000, 42},
		{"Beras", "gram", "karung", 5000, 100000, 13},
		{"Cup Plastik 16oz", "pcs", "dus", 1000, 12000, 520},
	}
}

func productBlueprints() []productBP {
	return []productBP{
		{"Espresso", 18000, "Kopi", map[string]float64{
			"Biji Kopi Arabika": 18, "Cup Plastik 16oz": 1}},
		{"Americano", 22000, "Kopi", map[string]float64{
			"Biji Kopi Arabika": 18, "Es Batu": 120, "Cup Plastik 16oz": 1}},
		{"Kopi Susu Gula Aren", 26000, "Kopi", map[string]float64{
			"Biji Kopi Robusta": 20, "Susu UHT Full Cream": 150,
			"Gula Aren Cair": 25, "Es Batu": 120, "Cup Plastik 16oz": 1}},
		{"Cappuccino", 28000, "Kopi", map[string]float64{
			"Biji Kopi Arabika": 18, "Susu UHT Full Cream": 180, "Cup Plastik 16oz": 1}},
		{"Cafe Latte", 30000, "Kopi", map[string]float64{
			"Biji Kopi Arabika": 18, "Susu UHT Full Cream": 200, "Cup Plastik 16oz": 1}},
		{"Kopi Tubruk", 15000, "Kopi", map[string]float64{
			"Biji Kopi Robusta": 15, "Gula Pasir": 10, "Cup Plastik 16oz": 1}},

		{"Matcha Latte", 32000, "Non-Kopi", map[string]float64{
			"Matcha Bubuk": 8, "Susu UHT Full Cream": 200, "Gula Pasir": 12,
			"Es Batu": 120, "Cup Plastik 16oz": 1}},
		{"Cokelat Panas", 27000, "Non-Kopi", map[string]float64{
			"Cokelat Bubuk": 20, "Susu UHT Full Cream": 180, "Gula Pasir": 10,
			"Cup Plastik 16oz": 1}},
		{"Teh Tarik", 20000, "Non-Kopi", map[string]float64{
			"Teh Hitam": 8, "Susu Kental Manis": 30, "Es Batu": 100, "Cup Plastik 16oz": 1}},
		{"Vanilla Milkshake", 33000, "Non-Kopi", map[string]float64{
			"Susu UHT Full Cream": 200, "Sirup Vanilla": 30, "Gula Pasir": 10,
			"Cup Plastik 16oz": 1}},
		{"Es Teh Manis", 10000, "Non-Kopi", map[string]float64{
			"Teh Hitam": 6, "Gula Pasir": 15, "Es Batu": 150, "Cup Plastik 16oz": 1}},

		{"Nasi Ayam Geprek", 28000, "Makanan Berat", map[string]float64{
			"Beras": 200, "Daging Ayam Fillet": 150, "Telur Ayam": 1}},
		{"Nasi Goreng Spesial", 30000, "Makanan Berat", map[string]float64{
			"Beras": 220, "Telur Ayam": 1, "Daging Ayam Fillet": 80}},
		{"Ayam Katsu Rice Bowl", 32000, "Makanan Berat", map[string]float64{
			"Beras": 200, "Daging Ayam Fillet": 160, "Telur Ayam": 1}},

		{"Roti Bakar Cokelat", 18000, "Snack", map[string]float64{
			"Roti Tawar": 2, "Cokelat Bubuk": 15, "Susu Kental Manis": 20}},
		// Sengaja tanpa resep: produk beli-jadi memang ada di outlet nyata, dan
		// layar opname maupun HPP harus tetap benar ketika sebuah produk tidak
		// mengurangi bahan baku apa pun.
		{"Kentang Goreng", 20000, "Snack", nil},

		{"Pudding Cokelat", 16000, "Dessert", map[string]float64{
			"Cokelat Bubuk": 18, "Susu UHT Full Cream": 120, "Gula Pasir": 20}},
		{"Es Krim Vanilla", 15000, "Dessert", map[string]float64{
			"Susu UHT Full Cream": 150, "Sirup Vanilla": 20, "Gula Pasir": 15}},

		{"Paket Kopi + Roti Bakar", 40000, "Paket Bundling", map[string]float64{
			"Biji Kopi Robusta": 20, "Susu UHT Full Cream": 150, "Gula Aren Cair": 25,
			"Roti Tawar": 2, "Cokelat Bubuk": 15, "Cup Plastik 16oz": 1}},
	}
}

var (
	customerNames = []string{
		"Umum", "Umum", "Umum", "Rizky", "Maya", "Pak Budi", "Bu Ani",
		"Gojek - Andi", "GrabFood", "Dimas", "Kirana", "Meeting Lt.3",
	}
	voidReasonCodes   = []string{"CUSTOMER_CANCEL", "WRONG_ITEM", "PRICE_ERROR", "DOUBLE_INPUT", "TRAINING"}
	returnReasonCodes = []string{"DAMAGED", "WRONG_ORDER", "CUSTOMER_CHANGED_MIND", "QUALITY_ISSUE"}
	productWasteCodes = []string{"EXPIRED", "SPILLED", "DAMAGED", "QUALITY_REJECT", "OTHER"}
	rmWasteReasons    = []string{
		"Kedaluwarsa", "Tumpah saat produksi", "Rusak saat penyimpanan",
		"Terkontaminasi", "Sisa produksi tidak terpakai",
	}
	suppliers    = []string{"CV Sumber Rasa", "PT Boga Nusantara", "Toko Grosir Melati", "UD Tani Makmur"}
	cardNetworks = []string{"VISA", "MASTERCARD", "GPN", "JCB"}
)

// ════════════════════════════════════════════════════════════════════════════
// Kerangka
// ════════════════════════════════════════════════════════════════════════════

type outletData struct {
	bp       outletBP
	outlet   *domain.Outlet
	version  int64
	staff    map[string]*domain.Staff
	cashiers []*domain.Staff
	cats     map[string]*domain.ProductCategory
	rms      []*domain.RawMaterial
	rmByName map[string]*domain.RawMaterial
	products []*domain.Product
	recipes  map[string]map[string]float64 // productID -> rawMaterialID -> qty
	shortSeq int
}

func (o *outletData) staffOf(identifier string) *domain.Staff { return o.staff[identifier] }

type builtTx struct {
	tx    *domain.Transaction
	items []*domain.TransactionItem
	pays  []*domain.TransactionPayment
}

type seeder struct {
	db   *gorm.DB
	rng  *rand.Rand
	days int
	now  time.Time

	business *domain.Business
	outlets  []*outletData

	// Timbunan yang disisipkan sekaligus di akhir, dalam urutan kunci asing.
	shifts    []*domain.Shift
	txs       []*domain.Transaction
	txItems   []*domain.TransactionItem
	txPays    []*domain.TransactionPayment
	returns   []*domain.Return
	retItems  []*domain.ReturnItem
	voidLogs  []*domain.VoidLog
	pWastes   []*domain.ProductWaste
	secEvents []*domain.SecurityEvent

	consumed map[string]float64 // rawMaterialID -> pemakaian bersih
	stockAdj map[string]float64 // rawMaterialID -> stok hasil opname disetujui

	order  []string
	counts map[string]int
}

func (s *seeder) add(label string, n int) {
	if _, ok := s.counts[label]; !ok {
		s.order = append(s.order, label)
	}
	s.counts[label] += n
}

// ════════════════════════════════════════════════════════════════════════════
// main
// ════════════════════════════════════════════════════════════════════════════

func main() {
	reset := flag.Bool("reset", false, "hapus seluruh data lama sebelum mengisi ulang")
	days := flag.Int("days", 14, "jumlah hari riwayat operasional (1-90)")
	flag.Parse()

	if *days < 1 || *days > 90 {
		log.Fatalf("-days harus di antara 1 dan 90, diterima %d", *days)
	}

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("gagal memuat config: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("gagal koneksi ke database: %v", err)
	}
	// Seeder menulis puluhan ribu baris; log per-pernyataan membuat keluarannya
	// tidak terbaca dan menyembunyikan galat yang sesungguhnya.
	db.Logger = logger.Default.LogMode(logger.Silent)

	var existing int64
	if err := db.Table("businesses").Count(&existing).Error; err != nil {
		log.Fatalf("gagal membaca tabel businesses (migrasi sudah dijalankan?): %v", err)
	}
	if existing > 0 && !*reset {
		log.Fatalf("database sudah berisi %d business.\n"+
			"  Jalankan ulang dengan -reset untuk menghapus data lama dan mengisi dari nol:\n"+
			"    go run ./cmd/seeder -reset", existing)
	}

	s := &seeder{
		db:       db,
		rng:      rand.New(rand.NewSource(rngSeed)),
		days:     *days,
		now:      time.Now().In(wib),
		consumed: map[string]float64{},
		stockAdj: map[string]float64{},
		counts:   map[string]int{},
	}

	start := time.Now()
	// Satu transaksi untuk seluruh proses. Seed yang gagal separuh jalan lebih
	// buruk daripada tidak ada seed sama sekali: skema tampak terisi, tetapi
	// shift kehilangan transaksinya dan QA melaporkan bug pada laporan yang
	// sebenarnya benar.
	if err := db.Transaction(func(tx *gorm.DB) error {
		root := s.db
		s.db = tx
		defer func() { s.db = root }()

		if *reset {
			stmt := "TRUNCATE TABLE " + strings.Join(dataTables, ", ") + " RESTART IDENTITY CASCADE"
			if err := tx.Exec(stmt).Error; err != nil {
				return fmt.Errorf("gagal mengosongkan tabel: %w", err)
			}
		}
		return s.run()
	}); err != nil {
		log.Fatalf("seeding gagal, seluruh perubahan dibatalkan: %v", err)
	}

	s.report(time.Since(start))
}

func (s *seeder) run() error {
	if err := s.seedBusiness(); err != nil {
		return err
	}
	for _, bp := range outletBlueprints() {
		od, err := s.seedOutletMaster(bp)
		if err != nil {
			return fmt.Errorf("outlet %s: %w", bp.ID, err)
		}
		s.outlets = append(s.outlets, od)
	}
	for _, od := range s.outlets {
		if err := s.seedInventoryLogs(od); err != nil {
			return fmt.Errorf("log inventori %s: %w", od.bp.ID, err)
		}
		s.buildOperations(od)
	}
	if err := s.flushOperations(); err != nil {
		return err
	}
	for _, od := range s.outlets {
		if err := s.seedOpnameSessions(od); err != nil {
			return fmt.Errorf("sesi opname %s: %w", od.bp.ID, err)
		}
	}
	if err := s.applyStock(); err != nil {
		return err
	}
	return s.seedAuditLogs()
}

// ════════════════════════════════════════════════════════════════════════════
// Master data
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) seedBusiness() error {
	hash, err := bcrypt.GenerateFromPassword([]byte(ownerPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	s.business = &domain.Business{
		ID:             businessID,
		SerialBusiness: serialBusiness,
		Email:          ownerEmail,
		Password:       string(hash),
		Name:           "Godinov Group",
		OwnerName:      "Bapak Godinov",
		CreatedAt:      s.dayStart(s.days).Add(-48 * time.Hour),
	}
	if err := s.db.Create(s.business).Error; err != nil {
		return err
	}
	s.add("businesses", 1)
	return nil
}

func (s *seeder) seedOutletMaster(bp outletBP) (*outletData, error) {
	od := &outletData{
		bp:       bp,
		version:  int64(10 + s.rng.Intn(5)),
		staff:    map[string]*domain.Staff{},
		cats:     map[string]*domain.ProductCategory{},
		rmByName: map[string]*domain.RawMaterial{},
		recipes:  map[string]map[string]float64{},
	}
	created := s.dayStart(s.days).Add(-24 * time.Hour)

	od.outlet = &domain.Outlet{
		ID: bp.ID, BusinessID: businessID, SerialOutlet: bp.Serial,
		Name: bp.Name, Address: bp.Address, CreatedAt: created,
	}
	if err := s.db.Create(od.outlet).Error; err != nil {
		return nil, err
	}
	s.add("outlets", 1)

	// ── Staf ────────────────────────────────────────────────────────────────
	pinHash, err := bcrypt.GenerateFromPassword([]byte(staffPIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	var staffs []*domain.Staff
	for _, sb := range bp.Staff {
		email := fmt.Sprintf("%s.%s@posgodinov.com", sb.Identifier, strings.ToLower(bp.ID))
		st := &domain.Staff{
			ID: utils.NewUUID(), OutletID: bp.ID,
			StaffIdentifier: sb.Identifier, Name: sb.Name, Email: &email,
			PINHash: string(pinHash), Role: domain.StaffRole(sb.Role),
			Permissions: sb.Perms, IsActive: true, CreatedAt: created,
		}
		staffs = append(staffs, st)
		od.staff[sb.Identifier] = st
		if sb.Role == string(domain.RoleCashier) {
			od.cashiers = append(od.cashiers, st)
		}
	}
	if err := s.db.Create(&staffs).Error; err != nil {
		return nil, err
	}
	s.add("users (staf)", len(staffs))

	// ── Kategori ────────────────────────────────────────────────────────────
	var cats []*domain.ProductCategory
	for _, name := range categoryNames() {
		c := &domain.ProductCategory{
			ID: utils.NewUUID(), OutletID: bp.ID, Name: name,
			Description: "Kategori " + name, CreatedAt: created,
		}
		cats = append(cats, c)
		od.cats[name] = c
	}
	if err := s.db.Create(&cats).Error; err != nil {
		return nil, err
	}
	s.add("product_categories", len(cats))

	// ── Bahan baku ──────────────────────────────────────────────────────────
	var rms []*domain.RawMaterial
	for _, rb := range rawMaterialBlueprints() {
		rm := &domain.RawMaterial{
			ID: utils.NewUUID(), OutletID: bp.ID, Name: rb.Name, Unit: rb.Unit,
			Stock: rb.Stock, CostPerUnit: rb.CostPerUnit,
			CreatedAt: created, UpdatedAt: created,
		}
		if rb.PackageUnit != "" {
			pu, qpp := rb.PackageUnit, rb.PerPackage
			rm.PackageUnit, rm.QuantityPerPackage = &pu, &qpp
		}
		rms = append(rms, rm)
		od.rmByName[rb.Name] = rm
	}
	if err := s.db.Create(&rms).Error; err != nil {
		return nil, err
	}
	od.rms = rms
	s.add("raw_materials", len(rms))

	// ── Produk + resep ──────────────────────────────────────────────────────
	var prods []*domain.Product
	var recipes []*domain.ProductRecipe
	for _, pb := range productBlueprints() {
		var catID *string
		if c, ok := od.cats[pb.Category]; ok {
			catID = &c.ID
		}
		p := &domain.Product{
			ID: utils.NewUUID(), OutletID: bp.ID, Name: pb.Name, Price: pb.Price,
			CategoryID: catID, CreatedAt: created, UpdatedAt: created,
			ImageURL: fmt.Sprintf("https://cdn.posgodinov.local/produk/%s.jpg", slug(pb.Name)),
		}
		prods = append(prods, p)

		if len(pb.Recipe) == 0 {
			continue
		}
		mix := map[string]float64{}
		for rmName, qty := range pb.Recipe {
			rm, ok := od.rmByName[rmName]
			if !ok {
				return nil, fmt.Errorf("resep %q merujuk bahan baku tidak dikenal: %q", pb.Name, rmName)
			}
			recipes = append(recipes, &domain.ProductRecipe{
				ID: utils.NewUUID(), ProductID: p.ID, RawMaterialID: rm.ID,
				Quantity: qty, CreatedAt: created,
			})
			mix[rm.ID] = qty
		}
		od.recipes[p.ID] = mix
	}
	if err := s.db.Create(&prods).Error; err != nil {
		return nil, err
	}
	if err := s.db.Create(&recipes).Error; err != nil {
		return nil, err
	}
	od.products = prods
	s.add("products", len(prods))
	s.add("product_recipes", len(recipes))

	// ── Versi master data ───────────────────────────────────────────────────
	if err := s.db.Exec(
		"INSERT INTO outlet_master_versions (outlet_id, version, updated_at) VALUES (?, ?, ?)",
		bp.ID, od.version, created,
	).Error; err != nil {
		return nil, err
	}
	s.add("outlet_master_versions", 1)

	return od, nil
}

// ════════════════════════════════════════════════════════════════════════════
// Log inventori: restock, pembuangan bahan, opname gaya lama
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) seedInventoryLogs(od *outletData) error {
	keeper := od.staffOf("stok01")

	var restocks []*domain.RestockLog
	var wastes []*domain.WasteLog
	var opnames []*domain.StockOpname

	// Kiriman supplier tidak datang tiap hari.
	for d := s.days; d >= 1; d-- {
		if d%3 != 0 {
			continue
		}
		day := s.dayStart(d)
		for _, rm := range od.rms {
			if s.rng.Float64() > 0.45 {
				continue
			}
			pkg := 1.0
			if rm.QuantityPerPackage != nil {
				pkg = *rm.QuantityPerPackage
			}
			qty := pkg * float64(1+s.rng.Intn(4))
			cost := round2(rm.CostPerUnit * (0.94 + s.rng.Float64()*0.14))
			restocks = append(restocks, &domain.RestockLog{
				ID: utils.NewUUID(), OutletID: od.bp.ID, RawMaterialID: rm.ID,
				Quantity: qty, CostPerUnit: cost, TotalCost: round2(qty * cost),
				SupplierName: suppliers[s.rng.Intn(len(suppliers))],
				RecordedBy:   keeper.ID,
				CreatedAt:    day.Add(time.Duration(6+s.rng.Intn(3)) * time.Hour),
			})
			s.consumed[rm.ID] -= qty // restock menambah stok
		}
	}

	for d := s.days; d >= 1; d-- {
		if d%4 != 0 {
			continue
		}
		day := s.dayStart(d)
		for i := 0; i < 1+s.rng.Intn(3); i++ {
			rm := od.rms[s.rng.Intn(len(od.rms))]
			qty := round2(float64(1+s.rng.Intn(40)) * 0.5)
			wastes = append(wastes, &domain.WasteLog{
				ID: utils.NewUUID(), OutletID: od.bp.ID, RawMaterialID: rm.ID,
				Quantity: qty, Reason: rmWasteReasons[s.rng.Intn(len(rmWasteReasons))],
				RecordedBy: keeper.ID,
				CreatedAt:  day.Add(time.Duration(19+s.rng.Intn(2)) * time.Hour),
			})
			s.consumed[rm.ID] += qty
		}
	}

	// Opname gaya lama (tabel stock_opnames) tetap diisi: laporan v1 masih
	// membacanya, dan QA perlu melihat kedua jalur berdampingan.
	for d := s.days; d >= 1; d -= 7 {
		day := s.dayStart(d)
		for _, rm := range od.rms {
			if s.rng.Float64() > 0.5 {
				continue
			}
			system := rm.Stock
			actual := math.Max(0, round2(system+(s.rng.Float64()-0.55)*system*0.03))
			inputType := "base_unit"
			var sysPkg, actPkg float64
			if rm.QuantityPerPackage != nil && *rm.QuantityPerPackage > 0 {
				if s.rng.Float64() < 0.4 {
					inputType = "package_unit"
				}
				sysPkg = round2(system / *rm.QuantityPerPackage)
				actPkg = round2(actual / *rm.QuantityPerPackage)
			}
			diffValue := round2((actual - system) * rm.CostPerUnit)
			opnames = append(opnames, &domain.StockOpname{
				ID: utils.NewUUID(), OutletID: od.bp.ID, RawMaterialID: rm.ID,
				SystemStock: system, ActualStock: actual,
				Difference:            round2(actual - system),
				FraudFlag:             isFraud(diffValue, system, actual),
				RecordedBy:            keeper.ID,
				InputType:             inputType,
				SystemPackageQuantity: sysPkg,
				ActualPackageQuantity: actPkg,
				DifferenceValue:       diffValue,
				Notes:                 "Opname mingguan",
				CreatedAt:             day.Add(22 * time.Hour),
			})
		}
	}

	if len(restocks) > 0 {
		if err := s.db.CreateInBatches(restocks, 200).Error; err != nil {
			return err
		}
		s.add("restock_logs", len(restocks))
	}
	if len(wastes) > 0 {
		if err := s.db.CreateInBatches(wastes, 200).Error; err != nil {
			return err
		}
		s.add("waste_logs", len(wastes))
	}
	if len(opnames) > 0 {
		if err := s.db.CreateInBatches(opnames, 200).Error; err != nil {
			return err
		}
		s.add("stock_opnames", len(opnames))
	}
	return nil
}

// ════════════════════════════════════════════════════════════════════════════
// Operasi harian: shift, transaksi, retur, void, pembuangan produk
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) buildOperations(od *outletData) {
	for d := s.days; d >= 0; d-- {
		day := s.dayStart(d)
		for di, device := range od.bp.Devices {
			// Hanya satu shift yang dibiarkan OPEN per outlet, pada perangkat
			// pertama hari ini. uq_shift_open_per_staff dan
			// uq_shift_open_per_device menolak lebih dari itu — dan memang
			// begitulah aturannya di lapangan.
			if d == 0 && di > 0 {
				continue // perangkat lain belum buka hari ini
			}
			s.buildShift(od, day, device, di, d == 0)
		}
	}
}

func (s *seeder) buildShift(od *outletData, day time.Time, device string, devIdx int, open bool) {
	cashier := od.cashiers[(day.YearDay()+devIdx)%len(od.cashiers)]
	spv := od.staffOf("spv01")

	openedAt := day.Add(8*time.Hour + time.Duration(s.rng.Intn(20))*time.Minute)
	closedAt := day.Add(21*time.Hour + time.Duration(s.rng.Intn(40))*time.Minute)
	if open && closedAt.After(s.now) {
		closedAt = s.now
	}

	sh := &domain.Shift{
		ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
		StaffID: cashier.ID, DeviceID: device,
		OpeningBalance:    float64(300000 + s.rng.Intn(4)*100000),
		Status:            domain.ShiftStatusOpen,
		ClientOpenedAt:    openedAt,
		CreatedAt:         openedAt,
		BlindClose:        true,
		MasterDataVersion: ptrI64(od.version),
	}

	// ── Transaksi ───────────────────────────────────────────────────────────
	n := 12 + s.rng.Intn(14)
	if open {
		n = 4 + s.rng.Intn(6)
	}
	window := closedAt.Sub(openedAt) - 30*time.Minute
	if window < time.Hour {
		window = time.Hour
	}

	var built []*builtTx
	for i := 0; i < n; i++ {
		at := openedAt.Add(15*time.Minute + time.Duration(s.rng.Int63n(int64(window))))
		built = append(built, s.buildTransaction(od, sh, cashier, spv, at))
	}

	// ── Retur ───────────────────────────────────────────────────────────────
	// Retur hanya pada shift yang sudah tutup: retur di shift berjalan membuat
	// nilai expected_* bergerak persis saat QA sedang membacanya.
	var refundCash, refundEDC, refundQRIS float64
	if !open {
		for _, bt := range built {
			if bt.tx.Status != domain.TxStatusCompleted || s.rng.Float64() > 0.09 {
				continue
			}
			c, e, q := s.buildReturn(od, sh, bt, cashier, spv)
			refundCash += c
			refundEDC += e
			refundQRIS += q
		}
	}

	// ── Void non-transaksi & pembuangan produk ──────────────────────────────
	s.buildLooseVoids(od, sh, cashier, spv, openedAt, window)
	s.buildProductWastes(od, sh, cashier, openedAt, window)

	// ── Tutup & rekonsiliasi ────────────────────────────────────────────────
	if !open {
		var cashIn, edcIn, qrisIn float64
		for _, bt := range built {
			if bt.tx.Status != domain.TxStatusCompleted {
				continue // cocok dengan WHERE t.status = 'COMPLETED' di repositori
			}
			for _, p := range bt.pays {
				switch p.Method {
				case domain.TenderCash:
					cashIn += p.Amount
				case domain.TenderDebit, domain.TenderCredit:
					edcIn += p.Amount
				case domain.TenderQRIS:
					qrisIn += p.Amount
				}
			}
		}
		expCash := round2(sh.OpeningBalance + cashIn - refundCash)
		expEDC := round2(edcIn - refundEDC)
		expQRIS := round2(qrisIn - refundQRIS)

		// Sebagian besar shift pas; sebagian selisih receh; satu dari sepuluh
		// melewati ambang Rp 5.000 supaya penandaan di dashboard punya sesuatu
		// untuk ditandai.
		drift := 0.0
		switch r := s.rng.Float64(); {
		case r < 0.55:
			drift = 0
		case r < 0.90:
			drift = float64(s.rng.Intn(9)-4) * 500
		default:
			drift = float64(s.rng.Intn(11)-5) * 4000
		}

		sh.Status = domain.ShiftStatusClosed
		sh.ClientClosedAt = ptrT(closedAt)
		sh.DeclaredCash = round2(expCash + drift)
		sh.DeclaredEDCTotal = expEDC
		sh.DeclaredQRISTotal = expQRIS
		sh.ClosingBalance = sh.DeclaredCash
		sh.ExpectedCash = ptrF(expCash)
		sh.ExpectedEDCTotal = ptrF(expEDC)
		sh.ExpectedQRISTotal = ptrF(expQRIS)
		sh.CashVariance = ptrF(round2(sh.DeclaredCash - expCash))
		sh.EDCVariance = ptrF(0)
		sh.QRISVariance = ptrF(0)
		sh.ReconciledAt = ptrT(closedAt.Add(5 * time.Minute))
		sh.ClosedBy = ptrS(cashier.ID)
		// Kolom v1 diisi ganda selama jendela deprekasi (lihat migrasi 000025).
		sh.ExpectedBalance = expCash
		sh.Discrepancy = round2(sh.DeclaredCash - expCash)

		if math.Abs(sh.Discrepancy) > varianceThreshold {
			s.pushSecurityEvent(od, sh, spv, domain.EventPINFailedThreshold,
				domain.SeverityWarn, closedAt,
				map[string]any{"cash_variance": sh.Discrepancy, "threshold": varianceThreshold})
		}
	}

	s.shifts = append(s.shifts, sh)
	for _, bt := range built {
		s.txs = append(s.txs, bt.tx)
		s.txItems = append(s.txItems, bt.items...)
		s.txPays = append(s.txPays, bt.pays...)
	}
	s.buildShiftSecurityEvents(od, sh, cashier, spv, openedAt)
}

func (s *seeder) buildTransaction(od *outletData, sh *domain.Shift, cashier, spv *domain.Staff, at time.Time) *builtTx {
	txID := utils.NewUUID()
	od.shortSeq++

	nItems := 1 + s.rng.Intn(4)
	perm := s.rng.Perm(len(od.products))
	var items []*domain.TransactionItem
	total := 0.0
	for i := 0; i < nItems; i++ {
		p := od.products[perm[i]]
		qty := 1 + s.rng.Intn(3)
		items = append(items, &domain.TransactionItem{
			ID: utils.NewUUID(), TransactionID: txID,
			ProductID: p.ID, Quantity: qty, UnitPrice: p.Price,
		})
		total += float64(qty) * p.Price
	}
	total = round2(total)

	tx := &domain.Transaction{
		ID: txID, ShiftID: sh.ID, OutletID: od.bp.ID, BusinessID: businessID,
		CustomerName:    customerNames[s.rng.Intn(len(customerNames))],
		TotalAmount:     total,
		Status:          domain.TxStatusCompleted,
		ClientCreatedAt: at,
		CreatedAt:       at.Add(time.Duration(s.rng.Intn(90)) * time.Second),
		DeviceID:        sh.DeviceID,
		ReturnState:     domain.ReturnStateNone,
		ShortCode:       ptrS(fmt.Sprintf("TRX-%s-%04d", strings.TrimPrefix(od.bp.ID, "OUT"), od.shortSeq)),
	}

	pays := s.buildPayments(txID, total, at)
	applyTenderSummary(tx, pays)

	switch r := s.rng.Float64(); {
	case r < 0.05:
		// VOIDED wajib belum tercetak (ck_void_requires_unprinted) — itu justru
		// aturannya: struk yang sudah keluar hanya boleh diretur, tidak divoid.
		tx.Status = domain.TxStatusVoided
		tx.VoidedAt = ptrT(at.Add(2 * time.Minute))
		tx.VoidedBy = ptrS(spv.ID)
		tx.VoidReasonCode = ptrS(voidReasonCodes[s.rng.Intn(len(voidReasonCodes))])
		s.voidLogs = append(s.voidLogs, &domain.VoidLog{
			ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
			DeviceID: sh.DeviceID, ShiftID: sh.ID, StaffID: cashier.ID,
			AuthorizedBy: ptrS(spv.ID), Scope: domain.VoidScopeTransaction,
			TransactionID:   ptrS(txID),
			ValueAmount:     total,
			ReasonCode:      *tx.VoidReasonCode,
			ReasonNotes:     "Dibatalkan sebelum struk tercetak",
			ClientCreatedAt: at.Add(2 * time.Minute),
			CreatedAt:       at.Add(3 * time.Minute),
		})
	case r < 0.08:
		tx.Status = domain.TxStatusCancelled
		tx.CancelNotes = "Pelanggan membatalkan pesanan"
	default:
		tx.ReceiptPrintedAt = ptrT(at.Add(40 * time.Second))
		if s.rng.Float64() < 0.06 {
			tx.ReprintCount = 1
			s.pushSecurityEvent(od, sh, cashier, domain.EventReceiptReprinted,
				domain.SeverityInfo, at.Add(3*time.Minute),
				map[string]any{"transaction_id": txID})
		}
		// Hanya penjualan yang benar-benar selesai yang memakan bahan baku.
		for _, it := range items {
			for rmID, qty := range od.recipes[it.ProductID] {
				s.consumed[rmID] += qty * float64(it.Quantity)
			}
		}
	}

	return &builtTx{tx: tx, items: items, pays: pays}
}

func (s *seeder) buildPayments(txID string, total float64, at time.Time) []*domain.TransactionPayment {
	mk := func(seq int, method string, amount float64) *domain.TransactionPayment {
		p := &domain.TransactionPayment{
			ID: utils.NewUUID(), TransactionID: txID, Sequence: seq,
			Method: method, Amount: round2(amount), CreatedAt: at,
		}
		// ck_card_requires_trace menolak tender kartu tanpa jejak EDC.
		if domain.IsCardTender(method) {
			trace := fmt.Sprintf("%012d", s.rng.Int63n(1000000000000))
			last4 := fmt.Sprintf("%04d", s.rng.Intn(10000))
			network := cardNetworks[s.rng.Intn(len(cardNetworks))]
			approval := fmt.Sprintf("%06d", s.rng.Intn(1000000))
			terminal := fmt.Sprintf("EDC%05d", s.rng.Intn(100000))
			p.TraceNumber, p.CardLast4 = &trace, &last4
			p.CardNetwork, p.ApprovalCode, p.EDCTerminalID = &network, &approval, &terminal
		}
		return p
	}

	// Split hanya masuk akal bila kedua sisi tetap positif setelah pembulatan;
	// ck_payment_amount_positive menolak tender bernilai nol.
	if total >= 30000 && s.rng.Float64() < 0.10 {
		first := round2(math.Floor(total*0.4/1000) * 1000)
		if first >= 1000 && first < total {
			other := domain.TenderQRIS
			if s.rng.Float64() < 0.5 {
				other = domain.TenderDebit
			}
			return []*domain.TransactionPayment{
				mk(1, domain.TenderCash, first),
				mk(2, other, round2(total-first)),
			}
		}
	}

	switch r := s.rng.Float64(); {
	case r < 0.42:
		return []*domain.TransactionPayment{mk(1, domain.TenderCash, total)}
	case r < 0.68:
		return []*domain.TransactionPayment{mk(1, domain.TenderQRIS, total)}
	case r < 0.84:
		return []*domain.TransactionPayment{mk(1, domain.TenderDebit, total)}
	case r < 0.95:
		return []*domain.TransactionPayment{mk(1, domain.TenderCredit, total)}
	default:
		return []*domain.TransactionPayment{mk(1, domain.TenderTransfer, total)}
	}
}

// applyTenderSummary mengisi kolom ringkasan pada transaksi dari daftar tender.
// Kolom-kolom ini adalah denormalisasi yang dibaca laporan; kalau diisi
// serampangan, laporan dan detail transaksi akan saling bertentangan dan QA
// tidak punya cara menentukan mana yang benar.
func applyTenderSummary(tx *domain.Transaction, pays []*domain.TransactionPayment) {
	tx.TenderCount = len(pays)
	for _, p := range pays {
		if p.Method == domain.TenderCash {
			tx.CashAmount = round2(tx.CashAmount + p.Amount)
		} else {
			tx.NonCashAmount = round2(tx.NonCashAmount + p.Amount)
		}
		if domain.IsCardTender(p.Method) && tx.PrimaryTraceNumber == nil {
			tx.PrimaryTraceNumber, tx.PrimaryCardLast4 = p.TraceNumber, p.CardLast4
		}
	}
	if len(pays) == 1 {
		tx.PaymentMethod = pays[0].Method
	} else {
		tx.PaymentMethod = domain.PaymentSummarySplit
	}
}

// buildReturn membuat satu retur atas transaksi yang sudah selesai dan
// mengembalikan nilai refund per kanal, supaya penutupan shift dapat
// menguranginya persis seperti kueri rekonsiliasi server.
func (s *seeder) buildReturn(od *outletData, sh *domain.Shift, bt *builtTx, cashier, spv *domain.Staff) (cash, edc, qris float64) {
	retID := utils.NewUUID()
	at := bt.tx.ClientCreatedAt.Add(time.Duration(20+s.rng.Intn(180)) * time.Minute)

	// uq_return_item melarang satu baris transaksi muncul dua kali dalam satu
	// retur, jadi item dipilih tanpa pengulangan.
	perm := s.rng.Perm(len(bt.items))
	take := 1 + s.rng.Intn(len(bt.items))
	var items []*domain.ReturnItem
	refund := 0.0
	fullyReturned := true

	for i, idx := range perm {
		it := bt.items[idx]
		if i >= take {
			fullyReturned = false
			continue
		}
		qty := it.Quantity
		if qty > 1 && s.rng.Float64() < 0.4 {
			qty = 1 + s.rng.Intn(it.Quantity-1)
		}
		if qty < it.Quantity {
			fullyReturned = false
		}
		restock := s.rng.Float64() < 0.7
		ri := &domain.ReturnItem{
			ID: utils.NewUUID(), ReturnID: retID, TransactionItemID: it.ID,
			ProductID: it.ProductID, Quantity: qty, UnitPrice: it.UnitPrice,
			Restock: restock,
		}
		if restock {
			// Barang yang kembali ke rak mengembalikan bahan bakunya juga.
			for rmID, q := range od.recipes[it.ProductID] {
				s.consumed[rmID] -= q * float64(qty)
			}
		} else {
			ri.WasteReasonCode = ptrS(productWasteCodes[s.rng.Intn(len(productWasteCodes))])
		}
		items = append(items, ri)
		refund += float64(qty) * it.UnitPrice
	}
	refund = round2(refund)

	retType, state := domain.ReturnTypePartial, domain.ReturnStatePartial
	if fullyReturned {
		retType, state = domain.ReturnTypeFull, domain.ReturnStateFull
	}

	method := domain.RefundCash
	switch bt.tx.PaymentMethod {
	case domain.TenderDebit, domain.TenderCredit:
		method = domain.RefundCardReversal
	case domain.TenderQRIS:
		method = domain.RefundQRISReversal
	case domain.TenderTransfer:
		method = domain.RefundStoreCredit
	}

	od.shortSeq++
	s.returns = append(s.returns, &domain.Return{
		ID: retID, OriginalTransactionID: bt.tx.ID, ShiftID: sh.ID,
		OutletID: od.bp.ID, BusinessID: businessID, DeviceID: sh.DeviceID,
		StaffID: cashier.ID, AuthorizedBy: ptrS(spv.ID),
		ReturnType: retType, RefundMethod: method, RefundAmount: refund,
		ReasonCode:       returnReasonCodes[s.rng.Intn(len(returnReasonCodes))],
		ReasonNotes:      "Diproses dengan persetujuan supervisor",
		ReceiptPrinted:   true,
		ReceiptPrintedAt: ptrT(at.Add(time.Minute)),
		ShortCode:        ptrS(fmt.Sprintf("RET-%s-%04d", strings.TrimPrefix(od.bp.ID, "OUT"), od.shortSeq)),
		ClientCreatedAt:  at,
		CreatedAt:        at.Add(30 * time.Second),
	})
	s.retItems = append(s.retItems, items...)
	bt.tx.ReturnState = state

	// EXCHANGE dan STORE_CREDIT tidak memindahkan uang, jadi tidak mengurangi
	// kanal mana pun — sama seperti kueri refund di repositori.
	switch method {
	case domain.RefundCash:
		cash = refund
	case domain.RefundCardReversal:
		edc = refund
	case domain.RefundQRISReversal:
		qris = refund
	}
	return cash, edc, qris
}

func (s *seeder) buildLooseVoids(od *outletData, sh *domain.Shift, cashier, spv *domain.Staff, openedAt time.Time, window time.Duration) {
	for i := 0; i < s.rng.Intn(4); i++ {
		at := openedAt.Add(time.Duration(s.rng.Int63n(int64(window))))
		p := od.products[s.rng.Intn(len(od.products))]
		before := 1 + s.rng.Intn(5)
		after := s.rng.Intn(before)

		v := &domain.VoidLog{
			ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
			DeviceID: sh.DeviceID, ShiftID: sh.ID, StaffID: cashier.ID,
			Scope: domain.VoidScopeCartLine, ProductID: ptrS(p.ID),
			QuantityBefore:  before,
			QuantityAfter:   after,
			ValueAmount:     round2(float64(before-after) * p.Price),
			ReasonCode:      voidReasonCodes[s.rng.Intn(len(voidReasonCodes))],
			ReasonNotes:     "Salah input jumlah",
			ClientCreatedAt: at,
			CreatedAt:       at,
		}
		// Ambang eskalasi POSConfig.VoidThresholdQty = 5.
		if before-after >= 5 {
			v.AuthorizedBy = ptrS(spv.ID)
			s.pushSecurityEvent(od, sh, cashier, domain.EventQtyDecreaseEscalated,
				domain.SeverityWarn, at, map[string]any{
					"product_id": p.ID, "quantity_before": before, "quantity_after": after})
		}
		s.voidLogs = append(s.voidLogs, v)
	}

	if s.rng.Float64() < 0.35 {
		at := openedAt.Add(time.Duration(s.rng.Int63n(int64(window))))
		p := od.products[s.rng.Intn(len(od.products))]
		snap, _ := json.Marshal([]map[string]any{
			{"product_id": p.ID, "name": p.Name, "quantity": 2, "unit_price": p.Price},
		})
		s.voidLogs = append(s.voidLogs, &domain.VoidLog{
			ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
			DeviceID: sh.DeviceID, ShiftID: sh.ID, StaffID: cashier.ID,
			AuthorizedBy: ptrS(spv.ID), Scope: domain.VoidScopeHeldOrder,
			HeldCartID:      ptrS(utils.NewUUID()),
			ValueAmount:     round2(2 * p.Price),
			ReasonCode:      "ABANDONED_ORDER",
			ReasonNotes:     "Pesanan tertahan tidak diambil sampai tutup",
			ItemsSnapshot:   domain.JSONB(snap),
			ClientCreatedAt: at,
			CreatedAt:       at,
		})
	}
}

func (s *seeder) buildProductWastes(od *outletData, sh *domain.Shift, cashier *domain.Staff, openedAt time.Time, window time.Duration) {
	for i := 0; i < s.rng.Intn(3); i++ {
		at := openedAt.Add(time.Duration(s.rng.Int63n(int64(window))))
		p := od.products[s.rng.Intn(len(od.products))]
		qty := 1 + s.rng.Intn(3)
		code := productWasteCodes[s.rng.Intn(len(productWasteCodes))]
		s.pWastes = append(s.pWastes, &domain.ProductWaste{
			ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
			StaffID: cashier.ID, ProductID: p.ID, Quantity: qty,
			Reason:          "Produk jadi dibuang: " + strings.ToLower(strings.ReplaceAll(code, "_", " ")),
			ReasonCode:      code,
			ShiftID:         ptrS(sh.ID),
			DeviceID:        sh.DeviceID,
			ReceiptPrinted:  true,
			PrintedAt:       ptrT(at.Add(time.Minute)),
			ClientCreatedAt: at,
			CreatedAt:       at.Add(20 * time.Second),
		})
		for rmID, q := range od.recipes[p.ID] {
			s.consumed[rmID] += q * float64(qty)
		}
	}
}

func (s *seeder) buildShiftSecurityEvents(od *outletData, sh *domain.Shift, cashier, spv *domain.Staff, openedAt time.Time) {
	if s.rng.Float64() < 0.30 {
		s.pushSecurityEvent(od, sh, spv, domain.EventKioskExitGranted, domain.SeverityInfo,
			openedAt.Add(2*time.Hour), map[string]any{"granted_to": cashier.StaffIdentifier})
	}
	if s.rng.Float64() < 0.20 {
		s.pushSecurityEvent(od, sh, cashier, domain.EventKioskExitDenied, domain.SeverityWarn,
			openedAt.Add(3*time.Hour), map[string]any{"reason": "permission KIOSK_EXIT tidak dimiliki"})
	}
	if s.rng.Float64() < 0.15 {
		s.pushSecurityEvent(od, sh, cashier, domain.EventLogoutBlockedActiveShift, domain.SeverityWarn,
			openedAt.Add(5*time.Hour), map[string]any{"shift_id": sh.ID})
	}
	if s.rng.Float64() < 0.08 {
		s.pushSecurityEvent(od, sh, cashier, domain.EventClockSkewDetected, domain.SeverityCritical,
			openedAt.Add(time.Hour), map[string]any{"skew_seconds": 420 + s.rng.Intn(600)})
	}
}

func (s *seeder) pushSecurityEvent(od *outletData, sh *domain.Shift, st *domain.Staff, eventType, severity string, at time.Time, details map[string]any) {
	raw, err := json.Marshal(details)
	if err != nil {
		raw = []byte("{}")
	}
	ev := &domain.SecurityEvent{
		ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
		DeviceID: sh.DeviceID, ShiftID: ptrS(sh.ID),
		EventType: eventType, Severity: severity, Details: domain.JSONB(raw),
		ClientCreatedAt: at, CreatedAt: at.Add(10 * time.Second),
	}
	if st != nil {
		ev.StaffID = ptrS(st.ID)
	}
	s.secEvents = append(s.secEvents, ev)
}

// flushOperations menyisipkan seluruh timbunan dalam urutan kunci asing.
func (s *seeder) flushOperations() error {
	steps := []struct {
		label string
		n     int
		fn    func() error
	}{
		{"shifts", len(s.shifts), func() error { return s.db.CreateInBatches(s.shifts, 200).Error }},
		{"transactions", len(s.txs), func() error { return s.db.CreateInBatches(s.txs, 200).Error }},
		{"transaction_items", len(s.txItems), func() error { return s.db.CreateInBatches(s.txItems, 400).Error }},
		{"transaction_payments", len(s.txPays), func() error { return s.db.CreateInBatches(s.txPays, 400).Error }},
		{"returns", len(s.returns), func() error { return s.db.CreateInBatches(s.returns, 200).Error }},
		{"return_items", len(s.retItems), func() error { return s.db.CreateInBatches(s.retItems, 400).Error }},
		{"void_logs", len(s.voidLogs), func() error { return s.db.CreateInBatches(s.voidLogs, 200).Error }},
		{"product_wastes", len(s.pWastes), func() error { return s.db.CreateInBatches(s.pWastes, 200).Error }},
		{"pos_security_events", len(s.secEvents), func() error { return s.db.CreateInBatches(s.secEvents, 200).Error }},
	}
	for _, st := range steps {
		if st.n == 0 {
			continue
		}
		if err := st.fn(); err != nil {
			return fmt.Errorf("gagal menyisipkan %s: %w", st.label, err)
		}
		s.add(st.label, st.n)
	}
	return nil
}

// ════════════════════════════════════════════════════════════════════════════
// Sesi opname (alur v2)
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) seedOpnameSessions(od *outletData) error {
	keeper := od.staffOf("stok01")
	manager := od.staffOf("manager01")
	device := od.bp.Devices[0]

	// Tiga status sekaligus supaya QA dapat menguji ketiga cabang layar tanpa
	// harus menyiapkan sesi sendiri: DRAFT masih bisa diubah, LOCKED menunggu
	// persetujuan, APPROVED sudah menyesuaikan stok.
	specs := []struct {
		status  string
		dayBack int
		scope   string
		notes   string
	}{
		{domain.OpnameStatusApproved, 5, domain.OpnameScopeFull, "Opname bulanan, disetujui manager"},
		{domain.OpnameStatusLocked, 2, domain.OpnameScopeCategory, "Menunggu persetujuan manager"},
		{domain.OpnameStatusDraft, 0, domain.OpnameScopePartial, "Hitungan berjalan"},
	}

	var sessions []*domain.OpnameSession
	var items []*domain.OpnameSessionItem

	for _, sp := range specs {
		at := s.dayStart(sp.dayBack).Add(20 * time.Hour)
		if at.After(s.now) {
			at = s.now.Add(-2 * time.Hour)
		}
		sess := &domain.OpnameSession{
			ID: utils.NewUUID(), OutletID: od.bp.ID, BusinessID: businessID,
			DeviceID: device, Scope: sp.scope, Status: sp.status,
			CountedBy: keeper.ID, Notes: sp.notes,
			ClientCreatedAt: at, CreatedAt: at.Add(time.Minute),
		}
		// ck_opname_locked_ts: DRAFT wajib locked_at NULL, selain DRAFT wajib terisi.
		if sp.status != domain.OpnameStatusDraft {
			sess.LockedAt = ptrT(at.Add(30 * time.Minute))
		}
		if sp.status == domain.OpnameStatusApproved {
			sess.ApprovedBy = ptrS(manager.ID)
			sess.ApprovedAt = ptrT(at.Add(50 * time.Minute))
		}

		count := len(od.rms)
		switch sp.scope {
		case domain.OpnameScopeCategory:
			count = 8
		case domain.OpnameScopePartial:
			count = 5
		}
		for i := 0; i < count && i < len(od.rms); i++ {
			rm := od.rms[i]
			system := s.projectedStock(rm)
			actual := math.Max(0, round2(system+(s.rng.Float64()-0.55)*system*0.04))
			inputType := "base_unit"
			var actPkg, sysPkg *float64
			if rm.QuantityPerPackage != nil && *rm.QuantityPerPackage > 0 {
				if s.rng.Float64() < 0.4 {
					inputType = "package_unit"
				}
				actPkg = ptrF(round2(actual / *rm.QuantityPerPackage))
				sysPkg = ptrF(round2(system / *rm.QuantityPerPackage))
			}

			it := &domain.OpnameSessionItem{
				ID: utils.NewUUID(), SessionID: sess.ID, RawMaterialID: rm.ID,
				ActualStock: actual, ActualPackageQuantity: actPkg,
				InputType: inputType,
			}
			// Nilai sistem baru dibekukan saat sesi dikunci; sesi DRAFT memang
			// belum memilikinya, dan layar harus tahan terhadap itu.
			if sp.status != domain.OpnameStatusDraft {
				diff := round2(actual - system)
				diffValue := round2(diff * rm.CostPerUnit)
				it.SystemStock = ptrF(system)
				it.SystemPackageQuantity = sysPkg
				it.Difference = ptrF(diff)
				it.DifferenceValue = ptrF(diffValue)
				it.FraudFlag = isFraud(diffValue, system, actual)
			}
			items = append(items, it)

			// Persetujuan opname adalah satu-satunya hal yang memindahkan stok
			// ke angka hasil hitung fisik.
			if sp.status == domain.OpnameStatusApproved {
				s.stockAdj[rm.ID] = actual
			}
		}
		sessions = append(sessions, sess)
	}

	if err := s.db.CreateInBatches(sessions, 50).Error; err != nil {
		return err
	}
	if err := s.db.CreateInBatches(items, 200).Error; err != nil {
		return err
	}
	s.add("opname_sessions", len(sessions))
	s.add("opname_session_items", len(items))
	return nil
}

// ════════════════════════════════════════════════════════════════════════════
// Stok akhir
// ════════════════════════════════════════════════════════════════════════════

// projectedStock adalah stok awal dikurangi pemakaian bersih (penjualan dan
// pembuangan) ditambah restock.
func (s *seeder) projectedStock(rm *domain.RawMaterial) float64 {
	v := round2(rm.Stock - s.consumed[rm.ID])
	// Lantai 5% menjaga stok tidak pernah negatif tanpa harus membesar-besarkan
	// stok awal sampai tidak masuk akal.
	if floor := round2(rm.Stock * 0.05); v < floor {
		return floor
	}
	return v
}

func (s *seeder) applyStock() error {
	n := 0
	for _, od := range s.outlets {
		for _, rm := range od.rms {
			final := s.projectedStock(rm)
			if adj, ok := s.stockAdj[rm.ID]; ok {
				final = adj // sesi opname yang disetujui menang
			}
			if err := s.db.Model(&domain.RawMaterial{}).
				Where("id = ?", rm.ID).
				Updates(map[string]any{"stock": final, "updated_at": s.now}).Error; err != nil {
				return fmt.Errorf("gagal memperbarui stok %s: %w", rm.Name, err)
			}
			rm.Stock = final
			n++
		}
	}
	s.add("raw_materials (stok disesuaikan)", n)
	return nil
}

// ════════════════════════════════════════════════════════════════════════════
// Audit log
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) seedAuditLogs() error {
	type entry struct {
		action, method, path string
		status               int
	}
	entries := []entry{
		{"BUSINESS_LOGIN", "POST", "/v1/auth/business/login", 200},
		{"OUTLET_CREATE", "POST", "/v1/business/outlets", 201},
		{"STAFF_CREATE", "POST", "/v1/business/staff", 201},
		{"STAFF_UPDATE", "PUT", "/v1/business/staff", 200},
		{"PRODUCT_CREATE", "POST", "/v1/inventory/products", 201},
		{"PRODUCT_UPDATE", "PUT", "/v1/inventory/products", 200},
		{"RAW_MATERIAL_CREATE", "POST", "/v1/inventory/raw-materials", 201},
		{"RESTOCK_RECORD", "POST", "/v1/inventory/restocks", 201},
		{"OPNAME_APPROVE", "POST", "/v1/inventory/opname-sessions/approve", 200},
		{"POS_SYNC_UP", "POST", "/v1/pos/sync/up", 200},
		{"REPORT_SHIFT_RECONCILE", "GET", "/v1/reports/shift-reconciliation", 200},
		{"BUSINESS_LOGIN_FAILED", "POST", "/v1/auth/business/login", 401},
	}

	var logs []*domain.AuditLog
	for i, e := range entries {
		details, _ := json.Marshal(map[string]any{"seeded": true, "sequence": i + 1})
		logs = append(logs, &domain.AuditLog{
			ID: utils.NewUUID(), ActorID: businessID, ActorType: "BUSINESS",
			Action: e.action, Method: e.method, Path: e.path,
			Details:    string(details),
			IPAddress:  fmt.Sprintf("10.20.%d.%d", s.rng.Intn(256), s.rng.Intn(256)),
			UserAgent:  "PostmanRuntime/7.44.0",
			StatusCode: e.status,
			CreatedAt:  s.dayStart(i % s.days).Add(time.Duration(9+i%10) * time.Hour),
		})
	}
	if err := s.db.CreateInBatches(logs, 100).Error; err != nil {
		return err
	}
	s.add("audit_logs", len(logs))
	return nil
}

// ════════════════════════════════════════════════════════════════════════════
// Laporan
// ════════════════════════════════════════════════════════════════════════════

func (s *seeder) report(elapsed time.Duration) {
	line := strings.Repeat("=", 74)
	fmt.Println()
	fmt.Println(line)
	fmt.Printf("  SEEDING SELESAI dalam %s — riwayat %d hari, benih tetap %d\n",
		elapsed.Round(time.Millisecond), s.days, rngSeed)
	fmt.Println(line)

	fmt.Println("\n  ISI TABEL")
	for _, k := range s.order {
		fmt.Printf("    %-34s %7d\n", k, s.counts[k])
	}

	fmt.Println("\n  KREDENSIAL PEMILIK")
	fmt.Printf("    Serial bisnis   : %s\n", serialBusiness)
	fmt.Printf("    Email / sandi   : %s / %s\n", ownerEmail, ownerPassword)

	fmt.Println("\n  OUTLET & AKUN")
	for _, od := range s.outlets {
		fmt.Printf("    %s  %s  (serial %s, device %s)\n",
			od.bp.ID, od.bp.Name, od.bp.Serial, strings.Join(od.bp.Devices, ", "))
		for _, sb := range od.bp.Staff {
			perms := "-"
			if len(sb.Perms) > 0 {
				perms = strings.Join(sb.Perms, ",")
			}
			fmt.Printf("      %-10s %-18s %-13s %s\n", sb.Identifier, sb.Name, sb.Role, perms)
		}
	}
	fmt.Printf("\n    PIN seluruh staf: %s\n", staffPIN)

	fmt.Println("\n  YANG SIAP DIUJI")
	fmt.Println("    - 1 shift OPEN per outlet, sisanya CLOSED dan sudah direkonsiliasi")
	fmt.Println("    - Transaksi COMPLETED / VOIDED / CANCELLED, tender tunggal & SPLIT")
	fmt.Println("    - Retur PARTIAL & FULL, refund CASH / CARD_REVERSAL / QRIS_REVERSAL")
	fmt.Println("    - Void bercakupan TRANSACTION, CART_LINE, dan HELD_ORDER")
	fmt.Println("    - Sesi opname berstatus DRAFT, LOCKED, dan APPROVED")
	fmt.Println("    - Sebagian shift sengaja selisih di atas ambang Rp 5.000")
	fmt.Println()
	fmt.Println(line)
}

// ════════════════════════════════════════════════════════════════════════════
// Utilitas
// ════════════════════════════════════════════════════════════════════════════

// dayStart mengembalikan pukul 00:00 WIB, `back` hari ke belakang dari hari ini.
func (s *seeder) dayStart(back int) time.Time {
	d := s.now.AddDate(0, 0, -back)
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, wib)
}

// round2 menyalin persis pembulatan milik shiftReconcileService. Memakai
// math.Round di sini akan berbeda satu sen pada nilai tertentu, dan setiap sen
// itu muncul sebagai "selisih kas" pada shift yang sebenarnya pas.
func round2(v float64) float64 {
	const scale = 100
	if v < 0 {
		return float64(int64(v*scale-0.5)) / scale
	}
	return float64(int64(v*scale+0.5)) / scale
}

func isFraud(diffValue, system, actual float64) bool {
	if math.Abs(diffValue) >= domain.OpnameFraudThreshold {
		return true
	}
	if system <= 0 {
		return false
	}
	return math.Abs(actual-system)/system >= domain.OpnameFraudRatio
}

func slug(v string) string {
	r := strings.NewReplacer(" ", "-", "+", "dan", "/", "-")
	return strings.ToLower(r.Replace(v))
}

func ptrS(v string) *string       { return &v }
func ptrF(v float64) *float64     { return &v }
func ptrI64(v int64) *int64       { return &v }
func ptrT(v time.Time) *time.Time { return &v }

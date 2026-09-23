package domain

// POSMasterStaff adalah Data Transfer Object (DTO) khusus untuk Klien POS
// agar data yang dikirim lebih ramping dan tidak mengekspos field yang tidak perlu.
type POSMasterStaff struct {
	ID              string `json:"id"`
	StaffIdentifier string `json:"staff_identifier"`
	Name            string `json:"name"`
	PINHash         string `json:"pin_hash"` // Diperlukan klien untuk validasi PIN offline

	// ── v2 · butir 4, 12, 14 ────────────────────────────────────────────────
	//
	// Peran dan izin dikirim agar otorisasi dapat diputuskan OFFLINE. Perangkat
	// yang harus bertanya ke server sebelum mengizinkan supervisor menyetujui
	// void akan lumpuh persis saat jaringan mati — yaitu saat kecurangan paling
	// mungkin terjadi.
	Role        StaffRole  `json:"role"`
	Permissions StringList `json:"permissions"`
}

type POSMasterCategory struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// POSMasterProduct HANYA mengekspos data kasir (Nama, Harga, Kategori, Image).
// Data resep (BOM) & bahan mentah (Raw Material) SENGAJA DIHAPUS dari payload klien
// untuk menghemat memori dan mempercepat proses rendering aplikasi POS offline.
type POSMasterProduct struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	ImageURL   string  `json:"image_url"`
	CategoryID *string `json:"category_id"`
}

// POSConfig adalah kebijakan operasional yang dikirim server ([11 §4.4]).
//
// Nilai-nilai ini hidup di server, bukan di kode klien, supaya pemilik dapat
// mengubah ambang batas TANPA merilis ulang tiga aplikasi. Klien WAJIB memiliki
// nilai bawaan hard-coded untuk perangkat yang belum pernah menarik master v2.
type POSConfig struct {
	// Penurunan kuantitas melebihi angka ini wajib lewat alur Void (butir 5).
	VoidThresholdQty int `json:"void_threshold_qty"`

	RequireSupervisorForVoid   bool `json:"require_supervisor_for_void"`
	RequireSupervisorForReturn bool `json:"require_supervisor_for_return"`

	BlindCloseEnabled  bool `json:"blind_close_enabled"`  // butir 9
	BlindOpnameEnabled bool `json:"blind_opname_enabled"` // butir 3

	KioskExitPermission string `json:"kiosk_exit_permission"` // butir 14
	HistoryScope        string `json:"history_scope"`         // butir 16

	MasterDataMaxAgeMinutes int `json:"master_data_max_age_minutes"` // butir 10
}

// DefaultPOSConfig adalah kebijakan bawaan sebelum pemilik menyesuaikannya.
//
// Seluruh nilai sengaja dipilih KETAT. Kebijakan yang longgar secara bawaan
// berarti outlet yang belum pernah membuka layar pengaturan berjalan tanpa
// pengendalian apa pun — dan itulah mayoritas outlet.
func DefaultPOSConfig() POSConfig {
	return POSConfig{
		VoidThresholdQty:           5,
		RequireSupervisorForVoid:   true,
		RequireSupervisorForReturn: true,
		BlindCloseEnabled:          true,
		BlindOpnameEnabled:         true,
		KioskExitPermission:        PermissionKioskExit,
		HistoryScope:               HistoryScopeActiveShift,
		MasterDataMaxAgeMinutes:    720,
	}
}

// Kamus izin ([11 §4.4]).
const (
	PermissionVoidApprove   = "VOID_APPROVE"
	PermissionReturnApprove = "RETURN_APPROVE"
	PermissionKioskExit     = "KIOSK_EXIT"
	PermissionOpnameCount   = "OPNAME_COUNT"
	PermissionForceClose    = "FORCE_CLOSE_SHIFT"

	HistoryScopeActiveShift = "ACTIVE_SHIFT"
	HistoryScopeAll         = "ALL"
)

// SyncMasterDataResponse adalah kerangka utama yang akan di-parsing oleh Frontend
//
// ⛔ TIDAK BOLEH menumbuhkan `products[].stock` atau `raw_materials[].stock`.
// Butir 3 gugur seketika bila stok sistem hadir di payload yang dipegang
// perangkat kasir atau opname — DevTools dan `adb logcat` membuat
// "disembunyikan di UI" menjadi tidak berarti ([11 §4.4]).
type SyncMasterDataResponse struct {
	// Versi monotonik per outlet. Gerbang Buka Shift membandingkannya dengan
	// versi yang dipegang perangkat (butir 10).
	Version int64 `json:"version"`

	Staffs     []*POSMasterStaff    `json:"staffs"`
	Categories []*POSMasterCategory `json:"categories"`
	Products   []*POSMasterProduct  `json:"products"`

	Config POSConfig `json:"config"`
}

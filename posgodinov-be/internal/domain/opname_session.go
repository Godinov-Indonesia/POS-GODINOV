package domain

import (
	"context"
	"time"
)

// Status sesi opname — transisi SATU ARAH ([11 §M16.2]).
//
//	DRAFT ──lock──> LOCKED ──approve──> APPROVED
//	                       ──reject───> REJECTED
//
// Tidak ada jalan kembali dari LOCKED ke DRAFT. Justru sifat satu arah itulah
// yang membuat angka hitungan dapat dipercaya: petugas tidak dapat melihat
// selisih lalu "memperbaiki" hitungannya.
const (
	OpnameStatusDraft    = "DRAFT"
	OpnameStatusLocked   = "LOCKED"
	OpnameStatusApproved = "APPROVED"
	OpnameStatusRejected = "REJECTED"

	OpnameScopeFull     = "FULL"
	OpnameScopeCategory = "CATEGORY"
	OpnameScopePartial  = "PARTIAL"
)

// OpnameSession — Blind Opname, butir 3 ([11 §3.2]).
//
// `stock_opnames` v1 menyimpan system_stock, actual_stock, dan difference dalam
// SATU baris yang ditulis sekali. Bentuk itu secara struktural mustahil
// menyembunyikan ekspektasi, karena barisnya hanya lahir setelah semuanya
// diketahui. Sesi dua-fase inilah yang memungkinkan butir 3.
type OpnameSession struct {
	ID         string `json:"id" gorm:"primaryKey;column:id"`
	OutletID   string `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID string `json:"business_id" gorm:"column:business_id"`
	DeviceID   string `json:"device_id" gorm:"column:device_id"`

	Scope  string `json:"scope" gorm:"column:scope"`
	Status string `json:"status" gorm:"column:status"`

	CountedBy  string  `json:"counted_by" gorm:"column:counted_by"`
	ApprovedBy *string `json:"approved_by" gorm:"column:approved_by"`

	// MOMEN PENGUNCIAN: snapshot `system_stock` diambil PERSIS di sini, tidak
	// lebih awal. Mengambilnya saat sesi dibuat membuat selisih salah untuk
	// bahan yang terjual selama penghitungan berlangsung.
	//
	// ⚠️ TANPA `omitempty`, sama seperti seluruh DTO opname. `locked_at: null`
	// yang eksplisit memberitahu klien bahwa sesinya BELUM terkunci; field yang
	// hilang menyisakan tebakan, dan klien yang menebak salah akan menampilkan
	// layar hasil untuk sesi yang masih dihitung.
	LockedAt   *time.Time `json:"locked_at" gorm:"column:locked_at"`
	ApprovedAt *time.Time `json:"approved_at" gorm:"column:approved_at"`

	Notes           string    `json:"notes" gorm:"column:notes"`
	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`

	Items []*OpnameSessionItem `json:"-" gorm:"foreignKey:SessionID"`
}

// OpnameSessionItem menyimpan hitungan fisik DAN — hanya setelah dikunci —
// ekspektasi sistem.
//
// ⚠️ Struct ini TIDAK PERNAH diserialisasi langsung ke klien. Lihat
// OpnameItemDraftDTO dan OpnameItemLockedDTO di bawah.
type OpnameSessionItem struct {
	ID            string `json:"-" gorm:"primaryKey;column:id"`
	SessionID     string `json:"-" gorm:"column:session_id"`
	RawMaterialID string `json:"-" gorm:"column:raw_material_id"`

	// SATU-SATUNYA kolom yang diisi petugas.
	ActualStock           float64  `json:"-" gorm:"column:actual_stock"`
	ActualPackageQuantity *float64 `json:"-" gorm:"column:actual_package_quantity"`
	InputType             string   `json:"-" gorm:"column:input_type"`

	// NULL selama status DRAFT. Inilah butir 3 dalam bentuk kolom.
	SystemStock           *float64 `json:"-" gorm:"column:system_stock"`
	SystemPackageQuantity *float64 `json:"-" gorm:"column:system_package_quantity"`
	Difference            *float64 `json:"-" gorm:"column:difference"`
	DifferenceValue       *float64 `json:"-" gorm:"column:difference_value"`
	FraudFlag             bool     `json:"-" gorm:"column:fraud_flag"`

	RecountOf *string `json:"-" gorm:"column:recount_of"`
	Notes     string  `json:"-" gorm:"column:notes"`
}

// ════════════════════════════════════════════════════════════════════════════
// DUA DTO, BUKAN SATU DENGAN `omitempty` — inti penegakan butir 3
// ════════════════════════════════════════════════════════════════════════════
//
// Satu struct ber-`omitempty` akan membocorkan ekspektasi begitu ada satu orang
// yang lupa menuliskan `nil` pada satu jalur. Dua struct membuat kebocoran itu
// MUSTAHIL DIKOMPILASI: OpnameItemDraftDTO secara harfiah tidak memiliki field
// untuk `system_stock`, sehingga tidak ada cara mengisinya ([11 §4.6]).

// OpnameItemDraftDTO adalah satu-satunya bentuk yang boleh dikirim selama sesi
// berstatus DRAFT.
//
// ⚠️ TANPA SATU PUN TAG `omitempty` — dan itu disengaja.
//
// `omitempty` menyembunyikan field bernilai nol dari keluaran JSON. Pada DTO
// ini efeknya berbahaya dua arah: uji kebocoran (DoD M16 butir 1) memeriksa
// SUBSTRING pada body mentah, sehingga field yang kebetulan bernilai nol akan
// lolos uji hari ini dan bocor besok ketika nilainya tidak nol lagi. Kejujuran
// bentuk lebih berharga daripada beberapa bita: `null` yang eksplisit
// memberitahu klien bahwa field-nya memang tidak punya nilai.
type OpnameItemDraftDTO struct {
	RawMaterialID         string   `json:"raw_material_id"`
	RawMaterialName       string   `json:"raw_material_name"`
	Unit                  string   `json:"unit"`
	PackageUnit           *string  `json:"package_unit"`
	QuantityPerPackage    *float64 `json:"quantity_per_package"`
	ActualStock           float64  `json:"actual_stock"`
	ActualPackageQuantity *float64 `json:"actual_package_quantity"`
	InputType             string   `json:"input_type"`
	Notes                 string   `json:"notes"`
}

// OpnameItemLockedDTO hanya dikembalikan oleh endpoint `lock` dan endpoint
// pemilik. Perangkat berperan STOCK_KEEPER tidak pernah menerimanya sebelum
// penguncian terjadi.
type OpnameItemLockedDTO struct {
	OpnameItemDraftDTO
	SystemStock           float64  `json:"system_stock"`
	SystemPackageQuantity *float64 `json:"system_package_quantity"`
	Difference            float64  `json:"difference"`
	DifferenceValue       float64  `json:"difference_value"`
	FraudFlag             bool     `json:"fraud_flag"`
}

type OpnameLockSummary struct {
	ItemsCounted       int     `json:"items_counted"`
	ItemsWithVariance  int     `json:"items_with_variance"`
	TotalVarianceValue float64 `json:"total_variance_value"`
}

type OpnameLockResponse struct {
	Status   string                 `json:"status"`
	LockedAt time.Time              `json:"locked_at"`
	Summary  OpnameLockSummary      `json:"summary"`
	Items    []*OpnameItemLockedDTO `json:"items"`
}

// OpnameDraftResponse sengaja TIDAK memuat ringkasan selisih apa pun — bahkan
// jumlah item yang berselisih. Angka itu saja sudah cukup memberi tahu petugas
// bahwa hitungannya "salah", dan ia akan menghitung ulang sampai angkanya nol.
type OpnameDraftResponse struct {
	ID           string                `json:"id"`
	Status       string                `json:"status"`
	Scope        string                `json:"scope"`
	ItemsCounted int                   `json:"items_counted"`
	Items        []*OpnameItemDraftDTO `json:"items"`
}

// OpnameFraudThreshold adalah ambang NOMINAL yang menandai satu item untuk
// ditinjau pemilik ([11 §M16.3]).
//
// Rumus `fraud_flag` memakai DUA ambang yang disatukan dengan OR:
//
//	|difference_value| > OpnameFraudThreshold   ATAU
//	|difference| / system_stock > OpnameFraudRatio
//
// Keduanya diperlukan karena masing-masing buta pada satu sisi. Ambang RASIO
// melewatkan kehilangan 4 kg dari 500 kg daging — 0,8 %, tetapi jutaan rupiah.
// Ambang NOMINAL melewatkan hilangnya seluruh persediaan garam — 100 %, tetapi
// hanya beberapa ribu rupiah, dan tetap merupakan tanda bahwa ada yang salah
// dengan penyimpanan atau pencatatannya.
const (
	OpnameFraudThreshold = 50000.0
	OpnameFraudRatio     = 0.10
)

// OpnameApproveResult melaporkan apa yang benar-benar berubah saat penyetujuan.
type OpnameApproveResult struct {
	SessionID     string  `json:"session_id"`
	Status        string  `json:"status"`
	ItemsAdjusted int     `json:"items_adjusted"`
	TotalVariance float64 `json:"total_variance_value"`
}

// OpnameSessionService mengelola transisi satu arah DRAFT → LOCKED → APPROVED
// ([11 §M16.3]).
type OpnameSessionService interface {
	Create(ctx context.Context, businessID, outletID, deviceID, countedBy string, req *CreateOpnameSessionRequest) (*OpnameSession, error)

	// UpsertItems menyimpan hitungan fisik. Responsnya TIDAK PERNAH memuat
	// angka ekspektasi — lihat OpnameItemDraftDTO.
	UpsertItems(ctx context.Context, businessID, outletID, sessionID string, items []*UpsertOpnameItemRequest) (*OpnameDraftResponse, error)

	GetDraft(ctx context.Context, businessID, outletID, sessionID string) (*OpnameDraftResponse, error)

	// Lock adalah SATU-SATUNYA jalur yang mengembalikan angka ekspektasi.
	Lock(ctx context.Context, businessID, outletID, sessionID string) (*OpnameLockResponse, error)

	// Approve menerapkan penyesuaian stok. Token BISNIS, bukan perangkat.
	Approve(ctx context.Context, businessID, outletID, sessionID, approvedBy string) (*OpnameApproveResult, error)
	Reject(ctx context.Context, businessID, outletID, sessionID, rejectedBy string) error

	ListSessions(ctx context.Context, businessID, outletID, status string, limit, offset int) ([]*OpnameSession, error)

	// GetLocked menyusun layar detail pemilik. Menolak sesi yang masih DRAFT:
	// pemilik pun tidak boleh melihat ekspektasi sebelum penguncian, karena ia
	// dapat membocorkannya kepada petugas yang sedang menghitung.
	GetLocked(ctx context.Context, businessID, outletID, sessionID string) (*OpnameLockResponse, error)
}

type CreateOpnameSessionRequest struct {
	// UUID DIBUAT KLIEN (aturan R2) — dasar idempotensi. Sesi yang dikirim
	// ulang karena jaringan putus tidak boleh melahirkan sesi kedua.
	ID    string `json:"id"`
	Scope string `json:"scope"`
	Notes string `json:"notes"`

	ClientCreatedAt time.Time `json:"client_created_at"`
}

type UpsertOpnameItemRequest struct {
	ID                    string   `json:"id"`
	RawMaterialID         string   `json:"raw_material_id"`
	ActualStock           float64  `json:"actual_stock"`
	ActualPackageQuantity *float64 `json:"actual_package_quantity"`
	InputType             string   `json:"input_type"`
	Notes                 string   `json:"notes"`
}

type OpnameSessionRepository interface {
	Create(ctx context.Context, session *OpnameSession) error
	GetByID(ctx context.Context, id string) (*OpnameSession, error)
	ListByOutlet(ctx context.Context, outletID, status string, limit, offset int) ([]*OpnameSession, error)

	UpsertItems(ctx context.Context, sessionID string, items []*OpnameSessionItem) error
	ListItems(ctx context.Context, sessionID string) ([]*OpnameSessionItem, error)

	// Lock menulis snapshot ekspektasi DAN memindahkan status dalam satu
	// transaksi basis data, dengan `SELECT ... FOR UPDATE` pada raw_materials.
	// Memisahkannya menjadi dua panggilan membuka jendela saat penjualan
	// mengubah stok di antara snapshot dan penguncian.
	Lock(ctx context.Context, sessionID string, lockedAt time.Time) error
	UpdateStatus(ctx context.Context, sessionID, status string, approvedBy *string, approvedAt *time.Time) error
}

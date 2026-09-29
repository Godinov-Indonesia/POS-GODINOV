package domain

import (
	"context"
	"time"
)

// ════════════════════════════════════════════════════════════════════════════
// STATUS — transisi satu arah, ditegakkan service DAN repository
// ════════════════════════════════════════════════════════════════════════════
//
//	OPEN ──publish──▶ PUBLISHED ──(auto)──▶ COUNTING ──close──▶ CLOSED
//	                                                            ├──approve──▶ APPROVED
//	                                                            └──reject───▶ REJECTED
//	                                                            └──recount──▶ OPEN (FORM BARU)
const (
	SOStatusOpen      = "OPEN"
	SOStatusPublished = "PUBLISHED"
	SOStatusCounting  = "COUNTING"
	SOStatusClosed    = "CLOSED"
	SOStatusApproved  = "APPROVED"
	SOStatusRejected  = "REJECTED"

	SOScopeFull     = "FULL"
	SOScopeCategory = "CATEGORY"
	SOScopePartial  = "PARTIAL"
)

// OpnameFraudThreshold dan OpnameFraudRatio — ambang flag fraud.
//
// Dua ambang disatukan dengan OR karena masing-masing buta pada satu sisi:
//   - RASIO (>10%) melewatkan kehilangan jutaan rupiah pada stok besar
//   - NOMINAL (>Rp 50.000) melewatkan hilangnya 100% stok murah
const (
	OpnameFraudThreshold = 50000.0
	OpnameFraudRatio     = 0.10
)

// ════════════════════════════════════════════════════════════════════════════
// ENTITIES
// ════════════════════════════════════════════════════════════════════════════

// OpnameSession merepresentasikan satu siklus stock opname.
type OpnameSession struct {
	ID            string     `json:"id" gorm:"primaryKey;column:id"`
	OutletID      string     `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID    string     `json:"business_id" gorm:"column:business_id"`
	Scope         string     `json:"scope" gorm:"column:scope"`
	Status        string     `json:"status" gorm:"column:status"`
	CreatedBy     string     `json:"created_by" gorm:"column:created_by"`
	ClosedBy      *string    `json:"closed_by" gorm:"column:closed_by"`
	ApprovedBy    *string    `json:"approved_by" gorm:"column:approved_by"`
	PublishedAt   *time.Time `json:"published_at" gorm:"column:published_at"`
	ClosedAt      *time.Time `json:"closed_at" gorm:"column:closed_at"`
	ApprovedAt    *time.Time `json:"approved_at" gorm:"column:approved_at"`
	RecountOf     *string    `json:"recount_of" gorm:"column:recount_of"`
	RecountNumber int        `json:"recount_number" gorm:"column:recount_number"`
	Notes         string     `json:"notes" gorm:"column:notes"`
	CreatedAt     time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

// OpnameFormItem — material yang dipilih admin untuk dihitung kasir.
// Diisi saat OPEN, tidak berubah setelah PUBLISHED.
type OpnameFormItem struct {
	ID            string `json:"id" gorm:"primaryKey;column:id"`
	SessionID     string `json:"-" gorm:"column:session_id"`
	RawMaterialID string `json:"raw_material_id" gorm:"column:raw_material_id"`
}

// OpnameCountEntry — hitungan individual per kasir.
//
// Unique per (session, material, kasir). Final actual_stock per material =
// SUM(actual_stock) dari semua kasir.
type OpnameCountEntry struct {
	ID                    string     `json:"id" gorm:"primaryKey;column:id"`
	SessionID             string     `json:"-" gorm:"column:session_id"`
	RawMaterialID         string     `json:"raw_material_id" gorm:"column:raw_material_id"`
	CountedBy             string     `json:"counted_by" gorm:"column:counted_by"`
	ActualStock           float64    `json:"actual_stock" gorm:"column:actual_stock"`
	ActualPackageQuantity *float64   `json:"actual_package_quantity" gorm:"column:actual_package_quantity"`
	InputType             string     `json:"input_type" gorm:"column:input_type"`
	Notes                 string     `json:"notes" gorm:"column:notes"`
	CreatedAt             time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
	UpdatedAt             time.Time  `json:"updated_at,omitzero" gorm:"column:updated_at"`
}

// OpnameSessionItem — hasil aggregated per material, diisi saat Close.
//
// actual_stock = SUM dari semua OpnameCountEntry untuk material ini.
// system_stock, difference, fraud_flag diisi saat Close (snapshot).
type OpnameSessionItem struct {
	ID            string `json:"-" gorm:"primaryKey;column:id"`
	SessionID     string `json:"-" gorm:"column:session_id"`
	RawMaterialID string `json:"-" gorm:"column:raw_material_id"`

	ActualStock           float64  `json:"-" gorm:"column:actual_stock"`
	ActualPackageQuantity *float64 `json:"-" gorm:"column:actual_package_quantity"`
	InputType             string   `json:"-" gorm:"column:input_type"`

	// NULL selama status belum CLOSED.
	SystemStock           *float64 `json:"-" gorm:"column:system_stock"`
	SystemPackageQuantity *float64 `json:"-" gorm:"column:system_package_quantity"`
	Difference            *float64 `json:"-" gorm:"column:difference"`
	DifferenceValue       *float64 `json:"-" gorm:"column:difference_value"`
	FraudFlag             bool     `json:"-" gorm:"column:fraud_flag"`

	RecountOf *string `json:"-" gorm:"column:recount_of"`
	Notes     string  `json:"-" gorm:"column:notes"`
}

// ════════════════════════════════════════════════════════════════════════════
// REQUEST DTOs
// ════════════════════════════════════════════════════════════════════════════

// CreateSOFormRequest — admin buat form SO baru.
type CreateSOFormRequest struct {
	ID             string   `json:"id"`
	Scope          string   `json:"scope"`
	Notes          string   `json:"notes"`
	RawMaterialIDs []string `json:"raw_material_ids"`
}

// UpdateFormItemsRequest — admin edit material list.
type UpdateFormItemsRequest struct {
	RawMaterialIDs []string `json:"raw_material_ids"`
}

// SubmitCountRequest — kasir kirim hasil hitungan.
type SubmitCountRequest struct {
	Items []*SubmitCountItemRequest `json:"items"`
}

// SubmitCountItemRequest — satu baris hitungan kasir.
type SubmitCountItemRequest struct {
	RawMaterialID         string   `json:"raw_material_id"`
	ActualStock           float64  `json:"actual_stock"`
	ActualPackageQuantity *float64 `json:"actual_package_quantity"`
	InputType             string   `json:"input_type"`
	Notes                 string   `json:"notes"`
}

// ════════════════════════════════════════════════════════════════════════════
// RESPONSE DTOs
// ════════════════════════════════════════════════════════════════════════════

// SOFormResponse — response untuk form yang belum di-close.
type SOFormResponse struct {
	ID            string              `json:"id"`
	OutletID      string              `json:"outlet_id"`
	Status        string              `json:"status"`
	Scope         string              `json:"scope"`
	Notes         string              `json:"notes"`
	CreatedBy     string              `json:"created_by"`
	RecountOf     *string             `json:"recount_of"`
	RecountNumber int                 `json:"recount_number"`
	PublishedAt   *time.Time          `json:"published_at"`
	ClosedAt      *time.Time          `json:"closed_at"`
	CreatedAt     time.Time           `json:"created_at"`
	Materials     []*SOFormMaterialDTO `json:"materials,omitempty"`
	CountProgress *SOCountProgress    `json:"count_progress,omitempty"`
}

// SOFormMaterialDTO — satu material di form, TANPA system_stock.
type SOFormMaterialDTO struct {
	RawMaterialID      string   `json:"raw_material_id"`
	RawMaterialName    string   `json:"raw_material_name"`
	Unit               string   `json:"unit"`
	PackageUnit        *string  `json:"package_unit"`
	QuantityPerPackage *float64 `json:"quantity_per_package"`
}

// SOCountProgress — progress penghitungan.
type SOCountProgress struct {
	TotalMaterials   int      `json:"total_materials"`
	CountedMaterials int      `json:"counted_materials"`
	Counters         []string `json:"counters"`
}

// SOClosedResponse — response untuk form yang sudah di-close.
type SOClosedResponse struct {
	ID            string           `json:"id"`
	OutletID      string           `json:"outlet_id"`
	Status        string           `json:"status"`
	Scope         string           `json:"scope"`
	Notes         string           `json:"notes"`
	CreatedBy     string           `json:"created_by"`
	RecountOf     *string          `json:"recount_of"`
	RecountNumber int              `json:"recount_number"`
	PublishedAt   *time.Time       `json:"published_at"`
	ClosedAt      *time.Time       `json:"closed_at"`
	CreatedAt     time.Time        `json:"created_at"`
	CountSheets   []*SOCountSheet  `json:"count_sheets"`
	FinalSheet    *SOFinalSheet    `json:"final_sheet"`
	History       []*SOHistoryEntry `json:"history,omitempty"`
}

// SOCountSheet — lembar hitungan SATU kasir.
type SOCountSheet struct {
	CountedBy string              `json:"counted_by"`
	StaffName string              `json:"staff_name"`
	Items     []*SOCountSheetItem `json:"items"`
}

// SOCountSheetItem — satu baris di lembar kasir.
type SOCountSheetItem struct {
	RawMaterialID         string   `json:"raw_material_id"`
	RawMaterialName       string   `json:"raw_material_name"`
	Unit                  string   `json:"unit"`
	ActualStock           float64  `json:"actual_stock"`
	ActualPackageQuantity *float64 `json:"actual_package_quantity"`
	InputType             string   `json:"input_type"`
	Notes                 string   `json:"notes"`
}

// SOFinalSheet — lembar final gabungan + diff.
type SOFinalSheet struct {
	Summary SOFinalSummary     `json:"summary"`
	Items   []*SOFinalSheetItem `json:"items"`
}

// SOFinalSummary — ringkasan selisih.
type SOFinalSummary struct {
	ItemsCounted       int     `json:"items_counted"`
	ItemsWithVariance  int     `json:"items_with_variance"`
	TotalVarianceValue float64 `json:"total_variance_value"`
}

// SOFinalSheetItem — satu baris di lembar final.
type SOFinalSheetItem struct {
	RawMaterialID         string   `json:"raw_material_id"`
	RawMaterialName       string   `json:"raw_material_name"`
	Unit                  string   `json:"unit"`
	PackageUnit           *string  `json:"package_unit"`
	QuantityPerPackage    *float64 `json:"quantity_per_package"`
	SystemStock           float64  `json:"system_stock"`
	SystemPackageQuantity *float64 `json:"system_package_quantity"`
	ActualStock           float64  `json:"actual_stock"`
	ActualPackageQuantity *float64 `json:"actual_package_quantity"`
	Difference            float64  `json:"difference"`
	DifferenceValue       float64  `json:"difference_value"`
	FraudFlag             bool     `json:"fraud_flag"`
}

// SOHistoryEntry — satu baris di chain recount.
type SOHistoryEntry struct {
	ID            string     `json:"id"`
	RecountNumber int        `json:"recount_number"`
	Status        string     `json:"status"`
	ClosedAt      *time.Time `json:"closed_at"`
	Label         string     `json:"label"`
}

// OpnameApproveResult — hasil penyetujuan opname.
type OpnameApproveResult struct {
	SessionID     string  `json:"session_id"`
	Status        string  `json:"status"`
	ItemsAdjusted int     `json:"items_adjusted"`
	TotalVariance float64 `json:"total_variance_value"`
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACE
// ════════════════════════════════════════════════════════════════════════════

type OpnameSessionService interface {
	// ── ADMIN (token bisnis) ────────────────────────────────────────────────

	// CreateForm membuat form SO baru berstatus OPEN.
	CreateForm(ctx context.Context, businessID, outletID, createdBy string,
		req *CreateSOFormRequest) (*SOFormResponse, error)

	// UpdateFormItems mengganti daftar material form. Hanya status OPEN.
	UpdateFormItems(ctx context.Context, businessID, outletID, formID string,
		rawMaterialIDs []string) (*SOFormResponse, error)

	// PublishForm memindahkan status OPEN → PUBLISHED.
	PublishForm(ctx context.Context, businessID, outletID, formID string) error

	// CloseForm menutup form: aggregate hitungan, snapshot system_stock,
	// hitung diff. Status COUNTING → CLOSED.
	CloseForm(ctx context.Context, businessID, outletID, formID, closedBy string) (*SOClosedResponse, error)

	// ApproveForm menyetujui form, menyesuaikan stok. Status CLOSED → APPROVED.
	ApproveForm(ctx context.Context, businessID, outletID, formID, approvedBy string) (*OpnameApproveResult, error)

	// RejectForm menolak form tanpa mengubah stok. Status CLOSED → REJECTED.
	RejectForm(ctx context.Context, businessID, outletID, formID, rejectedBy string) error

	// RecountForm membuat form BARU berdasarkan parent (copy material list).
	// Form lama tidak diubah. Status CLOSED/REJECTED → OPEN (form baru).
	RecountForm(ctx context.Context, businessID, outletID, formID, createdBy string) (*SOFormResponse, error)

	// GetFormDetail mengembalikan detail form:
	//   - OPEN/PUBLISHED/COUNTING → SOFormResponse (tanpa system_stock)
	//   - CLOSED/APPROVED/REJECTED → SOClosedResponse (dengan diff + lembar kasir)
	GetFormDetail(ctx context.Context, businessID, outletID, formID string) (interface{}, error)

	// ListForms mengembalikan daftar form SO per outlet.
	ListForms(ctx context.Context, businessID, outletID, status string,
		limit, offset int) ([]*SOFormResponse, error)

	// ── MOBILE / SO APP (device token OPNAME) ───────────────────────────────

	// ListAvailable mengembalikan form yang bisa dikerjakan kasir
	// (status PUBLISHED/COUNTING).
	ListAvailable(ctx context.Context, businessID, outletID string) ([]*SOFormResponse, error)

	// GetFormForCounting mengembalikan detail form untuk kasir (tanpa system_stock).
	GetFormForCounting(ctx context.Context, businessID, outletID, formID string) (*SOFormResponse, error)

	// SubmitCounts menyimpan hitungan kasir. Otomatis transisi PUBLISHED → COUNTING.
	SubmitCounts(ctx context.Context, businessID, outletID, formID, staffID string,
		items []*SubmitCountItemRequest) error

	// GetMyCounts mengembalikan hitungan kasir sendiri pada suatu form.
	GetMyCounts(ctx context.Context, businessID, outletID, formID, staffID string) (*SOCountSheet, error)
}

// ════════════════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ════════════════════════════════════════════════════════════════════════════

type OpnameSessionRepository interface {
	// ── Session CRUD ────────────────────────────────────────────────────────

	Create(ctx context.Context, session *OpnameSession) error
	GetByID(ctx context.Context, id string) (*OpnameSession, error)
	ListByOutlet(ctx context.Context, outletID string, statuses []string,
		limit, offset int) ([]*OpnameSession, error)

	// ── Form Items ──────────────────────────────────────────────────────────

	// SetFormItems mengganti seluruh material list form.
	SetFormItems(ctx context.Context, sessionID string, rawMaterialIDs []string) error
	ListFormItems(ctx context.Context, sessionID string) ([]*OpnameFormItem, error)

	// ── Count Entries ───────────────────────────────────────────────────────

	UpsertCountEntries(ctx context.Context, entries []*OpnameCountEntry) error
	ListCountEntries(ctx context.Context, sessionID string) ([]*OpnameCountEntry, error)
	ListCountEntriesByStaff(ctx context.Context, sessionID, staffID string) ([]*OpnameCountEntry, error)
	HasCountEntries(ctx context.Context, sessionID string) (bool, error)

	// ── Session Items (aggregated) ──────────────────────────────────────────

	ListItems(ctx context.Context, sessionID string) ([]*OpnameSessionItem, error)

	// ── Status Transitions ──────────────────────────────────────────────────

	// Publish: OPEN → PUBLISHED
	Publish(ctx context.Context, sessionID string, publishedAt time.Time) error

	// MarkCounting: PUBLISHED → COUNTING (otomatis saat kasir pertama submit)
	MarkCounting(ctx context.Context, sessionID string) error

	// Close: aggregate count_entries → session_items, snapshot system_stock,
	// hitung diff, COUNTING → CLOSED. Satu transaksi.
	Close(ctx context.Context, sessionID string, closedAt time.Time, closedBy string) error

	// Approve: CLOSED → APPROVED
	Approve(ctx context.Context, sessionID string, approvedBy string, approvedAt time.Time) error

	// Reject: CLOSED → REJECTED
	Reject(ctx context.Context, sessionID string, rejectedBy string, rejectedAt time.Time) error

	// ── Recount ─────────────────────────────────────────────────────────────

	// GetRecountChain mengembalikan seluruh chain recount dari akar sampai leaf.
	GetRecountChain(ctx context.Context, sessionID string) ([]*OpnameSession, error)
}

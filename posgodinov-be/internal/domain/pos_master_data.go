package domain

// POSMasterStaff adalah Data Transfer Object (DTO) khusus untuk Klien POS
// agar data yang dikirim lebih ramping dan tidak mengekspos field yang tidak perlu.
type POSMasterStaff struct {
	ID              string `json:"id"`
	StaffIdentifier string `json:"staff_identifier"`
	Name            string `json:"name"`
	PINHash         string `json:"pin_hash"` // Diperlukan klien untuk validasi PIN offline
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

// SyncMasterDataResponse adalah kerangka utama yang akan di-parsing oleh Frontend
type SyncMasterDataResponse struct {
	Staffs     []*POSMasterStaff    `json:"staffs"`
	Categories []*POSMasterCategory `json:"categories"`
	Products   []*POSMasterProduct  `json:"products"`
}

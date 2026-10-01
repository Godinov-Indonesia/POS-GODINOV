package domain

import "context"

// UploadPurpose mendefinisikan kategori atau target penyimpanan aset di Cloudinary.
type UploadPurpose string

const (
	UploadPurposeProduct UploadPurpose = "products"
	UploadPurposeProfile UploadPurpose = "profiles"
	UploadPurposeGeneral UploadPurpose = "general"
)

// CreateUploadSignatureRequest payload dari frontend saat meminta signature upload.
type CreateUploadSignatureRequest struct {
	Purpose UploadPurpose `json:"purpose"`
}

// UploadSignatureResponse berisi token/signature dan kredensial yang dibutuhkan
// klien frontend untuk mengunggah binary file langsung ke Cloudinary.
type UploadSignatureResponse struct {
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
	APIKey    string `json:"api_key"`
	CloudName string `json:"cloud_name"`
	Folder    string `json:"folder"`
}

// UploadService menyediakan layanan lisensi/signature upload aset multi-tenant.
type UploadService interface {
	GenerateUploadSignature(ctx context.Context, businessID string, purpose UploadPurpose) (*UploadSignatureResponse, error)
}

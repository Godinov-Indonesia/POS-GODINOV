package domain

import "context"

// UploadSignatureResponse berisi token/signature dan kredensial yang dibutuhkan
// klien frontend untuk mengunggah binary file langsung ke Cloudinary.
type UploadSignatureResponse struct {
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
	APIKey    string `json:"api_key"`
	CloudName string `json:"cloud_name"`
	Folder    string `json:"folder"`
}

// UploadService menyediakan layanan lisensi/signature upload aset.
type UploadService interface {
	GenerateProductImageSignature(ctx context.Context) (*UploadSignatureResponse, error)
}

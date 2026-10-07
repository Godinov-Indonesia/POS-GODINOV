package domain

import (
	"context"
	"net/http"
	"time"
)

type PaymentHubClient interface {
	// Kasir nontunai (Customer → Business)
	GenerateDynamicQRIS(ctx context.Context, req *QRISRequest) (*QRISResponse, error)
	CreateVirtualAccount(ctx context.Context, req *VARequest) (*VAResponse, error)
	CheckPaymentStatus(ctx context.Context, referenceID string) (*PaymentStatusResult, error)
	CancelPayment(ctx context.Context, referenceID string) error

	// Tagihan langganan SaaS (Business → Landlord)
	CreateSubscriptionInvoice(ctx context.Context, inv *SubscriptionInvoiceRequest) (*CheckoutResponse, error)

	// Pencairan saldo (Escrow → Rekening Bank)
	CreateDisbursement(ctx context.Context, req *DisbursementRequest) (*DisbursementResponse, error)
	CheckDisbursementStatus(ctx context.Context, disbursementID string) (*DisbursementResult, error)

	// Keamanan webhook
	VerifyWebhookSignature(r *http.Request) (*PaymentHubWebhookPayload, error)
}

// DTO structs
type QRISRequest struct {
	TransactionID string            `json:"transaction_id"`
	BusinessID    string            `json:"business_id"`
	OutletID      string            `json:"outlet_id"`
	AmountMinor   int64             `json:"amount_minor"`
	ExpiryMinutes int               `json:"expiry_minutes"`
	Metadata      map[string]string `json:"metadata"`
}

type QRISResponse struct {
	TransactionID string    `json:"transaction_id"`
	QRPayload     string    `json:"qr_payload"`
	QRImageURL    string    `json:"qr_image_url"`
	ExpiredAt     time.Time `json:"expired_at"`
}

type VARequest struct {
	TransactionID string `json:"transaction_id"`
	BusinessID    string `json:"business_id"`
	BankCode      string `json:"bank_code"`
	CustomerName  string `json:"customer_name"`
	AmountMinor   int64  `json:"amount_minor"`
	ExpiryMinutes int    `json:"expiry_minutes"`
}

type VAResponse struct {
	TransactionID string    `json:"transaction_id"`
	BankCode      string    `json:"bank_code"`
	VANumber      string    `json:"va_number"`
	ExpiredAt     time.Time `json:"expired_at"`
}

type PaymentStatusResult struct {
	ReferenceID string `json:"reference_id"`
	Status      string `json:"status"` // PENDING, PAID, EXPIRED, CANCELLED
}

type SubscriptionInvoiceRequest struct {
	InvoiceNumber string `json:"invoice_number"`
	BusinessID    string `json:"business_id"`
	PlanName      string `json:"plan_name"`
	AmountMinor   int64  `json:"amount_minor"`
	TaxMinor      int64  `json:"tax_minor"`
	TotalMinor    int64  `json:"total_minor"`
}

type CheckoutResponse struct {
	GatewayReference string `json:"gateway_reference"`
	PaymentURL       string `json:"payment_url"`
	QRPayload        string `json:"qr_payload,omitempty"`
	VANumber         string `json:"va_number,omitempty"`
}

type DisbursementRequest struct {
	PayoutNumber    string `json:"payout_number"`
	BusinessID      string `json:"business_id"`
	BankCode        string `json:"bank_code"`
	AccountNumber   string `json:"account_number"`
	AccountName     string `json:"account_name"`
	AmountMinor     int64  `json:"amount_minor"`
	DisbursementFee int64  `json:"disbursement_fee"`
}

type DisbursementResponse struct {
	PayoutNumber    string    `json:"payout_number"`
	DisbursementRef string    `json:"disbursement_ref"`
	Status          string    `json:"status"`
	EstimatedTime   time.Time `json:"estimated_time"`
}

type DisbursementResult struct {
	DisbursementRef string `json:"disbursement_ref"`
	Status          string `json:"status"`
}

type PaymentHubWebhookPayload struct {
	Event       string `json:"event"` // payment.settled, payment.expired, disbursement.completed
	ReferenceID string `json:"reference_id"`
	AmountMinor int64  `json:"amount_minor"`
	BusinessID  string `json:"business_id"`
}

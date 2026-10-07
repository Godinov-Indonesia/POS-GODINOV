package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"posgodinov-backend/internal/domain"
)

// MockPaymentHubAdapter — langsung approve semua payment (dev/test only).
// Ganti dengan HttpPaymentHubAdapter saat godinov-payment-hub live.
type MockPaymentHubAdapter struct {
	DefaultPaymentStatus string // default: PAID
	DefaultDisbStatus    string // default: COMPLETED
}

func NewMockPaymentHubAdapter() *MockPaymentHubAdapter {
	return &MockPaymentHubAdapter{
		DefaultPaymentStatus: "PAID",
		DefaultDisbStatus:    "COMPLETED",
	}
}

var _ domain.PaymentHubClient = (*MockPaymentHubAdapter)(nil)

func (m *MockPaymentHubAdapter) GenerateDynamicQRIS(ctx context.Context, req *domain.QRISRequest) (*domain.QRISResponse, error) {
	expiryMins := req.ExpiryMinutes
	if expiryMins <= 0 {
		expiryMins = 15
	}
	expiredAt := time.Now().Add(time.Duration(expiryMins) * time.Minute)
	qrPayload := fmt.Sprintf("00020101021226580211%s%d", req.TransactionID, req.AmountMinor)
	qrImageURL := fmt.Sprintf("https://mock-payment.godinov.com/qr/%s.png", req.TransactionID)

	return &domain.QRISResponse{
		TransactionID: req.TransactionID,
		QRPayload:     qrPayload,
		QRImageURL:    qrImageURL,
		ExpiredAt:     expiredAt,
	}, nil
}

func (m *MockPaymentHubAdapter) CreateVirtualAccount(ctx context.Context, req *domain.VARequest) (*domain.VAResponse, error) {
	expiryMins := req.ExpiryMinutes
	if expiryMins <= 0 {
		expiryMins = 1440 // 24 jam
	}
	expiredAt := time.Now().Add(time.Duration(expiryMins) * time.Minute)
	vaNumber := fmt.Sprintf("8808%s", req.TransactionID)
	if len(vaNumber) > 16 {
		vaNumber = vaNumber[:16]
	}

	return &domain.VAResponse{
		TransactionID: req.TransactionID,
		BankCode:      req.BankCode,
		VANumber:      vaNumber,
		ExpiredAt:     expiredAt,
	}, nil
}

func (m *MockPaymentHubAdapter) CheckPaymentStatus(ctx context.Context, referenceID string) (*domain.PaymentStatusResult, error) {
	status := m.DefaultPaymentStatus
	if status == "" {
		status = "PAID"
	}
	return &domain.PaymentStatusResult{
		ReferenceID: referenceID,
		Status:      status,
	}, nil
}

func (m *MockPaymentHubAdapter) CancelPayment(ctx context.Context, referenceID string) error {
	return nil
}

func (m *MockPaymentHubAdapter) CreateSubscriptionInvoice(ctx context.Context, inv *domain.SubscriptionInvoiceRequest) (*domain.CheckoutResponse, error) {
	ref := fmt.Sprintf("MOCK-INV-%s", inv.InvoiceNumber)
	payURL := fmt.Sprintf("https://checkout.godinov.com/pay/%s", inv.InvoiceNumber)
	qrPayload := fmt.Sprintf("00020101021226MOCKINV%s", inv.InvoiceNumber)
	vaNumber := "880800000001"

	return &domain.CheckoutResponse{
		GatewayReference: ref,
		PaymentURL:       payURL,
		QRPayload:        qrPayload,
		VANumber:         vaNumber,
	}, nil
}

func (m *MockPaymentHubAdapter) CreateDisbursement(ctx context.Context, req *domain.DisbursementRequest) (*domain.DisbursementResponse, error) {
	status := m.DefaultDisbStatus
	if status == "" {
		status = "COMPLETED"
	}
	return &domain.DisbursementResponse{
		PayoutNumber:    req.PayoutNumber,
		DisbursementRef: fmt.Sprintf("MOCK-DISB-%s", req.PayoutNumber),
		Status:          status,
		EstimatedTime:   time.Now(),
	}, nil
}

func (m *MockPaymentHubAdapter) CheckDisbursementStatus(ctx context.Context, disbursementID string) (*domain.DisbursementResult, error) {
	status := m.DefaultDisbStatus
	if status == "" {
		status = "COMPLETED"
	}
	return &domain.DisbursementResult{
		DisbursementRef: disbursementID,
		Status:          status,
	}, nil
}

func (m *MockPaymentHubAdapter) VerifyWebhookSignature(r *http.Request) (*domain.PaymentHubWebhookPayload, error) {
	if r.Body == nil {
		return nil, fmt.Errorf("empty webhook body")
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}
	// Restore body for downstream handlers
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	var payload domain.PaymentHubWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("invalid webhook JSON: %w", err)
	}
	return &payload, nil
}

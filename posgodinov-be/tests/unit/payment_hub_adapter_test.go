package unit

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"posgodinov-backend/internal/adapter"
	"posgodinov-backend/internal/domain"
)

func TestMockPaymentHubAdapter_AllMethods(t *testing.T) {
	ctx := context.Background()
	client := adapter.NewMockPaymentHubAdapter()

	t.Run("GenerateDynamicQRIS", func(t *testing.T) {
		req := &domain.QRISRequest{
			TransactionID: "TRX-101",
			BusinessID:    "BIZ-1",
			OutletID:      "OUT-1",
			AmountMinor:   5000000,
			ExpiryMinutes: 15,
		}
		resp, err := client.GenerateDynamicQRIS(ctx, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.TransactionID != "TRX-101" {
			t.Errorf("expected TRX-101, got %s", resp.TransactionID)
		}
		if resp.QRPayload == "" || resp.QRImageURL == "" {
			t.Errorf("expected payload and image URL, got empty")
		}
		if resp.ExpiredAt.Before(time.Now()) {
			t.Errorf("expected expiry in future, got %v", resp.ExpiredAt)
		}
	})

	t.Run("CreateVirtualAccount", func(t *testing.T) {
		req := &domain.VARequest{
			TransactionID: "TRX-102",
			BusinessID:    "BIZ-1",
			BankCode:      "BCA",
			CustomerName:  "Andi",
			AmountMinor:   10000000,
			ExpiryMinutes: 60,
		}
		resp, err := client.CreateVirtualAccount(ctx, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.BankCode != "BCA" {
			t.Errorf("expected BCA, got %s", resp.BankCode)
		}
		if resp.VANumber == "" {
			t.Errorf("expected VA number, got empty")
		}
		if resp.ExpiredAt.Before(time.Now()) {
			t.Errorf("expected expiry in future, got %v", resp.ExpiredAt)
		}
	})

	t.Run("CheckPaymentStatus and CancelPayment", func(t *testing.T) {
		res, err := client.CheckPaymentStatus(ctx, "TRX-103")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.ReferenceID != "TRX-103" || res.Status != "PAID" {
			t.Errorf("expected PAID status for TRX-103, got %s (%s)", res.Status, res.ReferenceID)
		}

		if err := client.CancelPayment(ctx, "TRX-103"); err != nil {
			t.Errorf("unexpected error on CancelPayment: %v", err)
		}
	})

	t.Run("CreateSubscriptionInvoice", func(t *testing.T) {
		req := &domain.SubscriptionInvoiceRequest{
			InvoiceNumber: "INV-2026-001",
			BusinessID:    "BIZ-1",
			PlanName:      "PRO_MONTHLY",
			AmountMinor:   15000000,
			TaxMinor:      1650000,
			TotalMinor:    16650000,
		}
		resp, err := client.CreateSubscriptionInvoice(ctx, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.GatewayReference != "MOCK-INV-INV-2026-001" {
			t.Errorf("expected MOCK-INV-INV-2026-001, got %s", resp.GatewayReference)
		}
		if resp.PaymentURL == "" {
			t.Errorf("expected payment URL, got empty")
		}
	})

	t.Run("CreateDisbursement and CheckDisbursementStatus", func(t *testing.T) {
		req := &domain.DisbursementRequest{
			PayoutNumber:    "PO-2026-01",
			BusinessID:      "BIZ-1",
			BankCode:        "BCA",
			AccountNumber:   "1234567890",
			AccountName:     "Kopi Mantap",
			AmountMinor:     25000000,
			DisbursementFee: 250000,
		}
		resp, err := client.CreateDisbursement(ctx, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.PayoutNumber != "PO-2026-01" || resp.Status != "COMPLETED" {
			t.Errorf("expected PO-2026-01 / COMPLETED, got %s / %s", resp.PayoutNumber, resp.Status)
		}

		checkRes, err := client.CheckDisbursementStatus(ctx, resp.DisbursementRef)
		if err != nil {
			t.Fatalf("unexpected error on CheckDisbursementStatus: %v", err)
		}
		if checkRes.Status != "COMPLETED" {
			t.Errorf("expected COMPLETED, got %s", checkRes.Status)
		}
	})

	t.Run("VerifyWebhookSignature", func(t *testing.T) {
		payload := domain.PaymentHubWebhookPayload{
			Event:       "payment.settled",
			ReferenceID: "TRX-101",
			AmountMinor: 5000000,
			BusinessID:  "BIZ-1",
		}
		bodyBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewBuffer(bodyBytes))

		parsed, err := client.VerifyWebhookSignature(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if parsed.Event != "payment.settled" || parsed.ReferenceID != "TRX-101" {
			t.Errorf("expected payment.settled / TRX-101, got %s / %s", parsed.Event, parsed.ReferenceID)
		}

		// Invalid JSON
		badReq := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewBufferString("{bad-json"))
		if _, err := client.VerifyWebhookSignature(badReq); err == nil {
			t.Fatal("expected error for bad json, got nil")
		}
	})
}

package domain

import (
	"context"
	"time"
)

type Shift struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id"`
	OutletID       string    `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID     string    `json:"business_id" gorm:"column:business_id"`
	StaffID        string    `json:"staff_id" gorm:"column:staff_id"`
	OpeningBalance float64   `json:"opening_balance" gorm:"column:opening_balance"`
	ClosingBalance float64   `json:"closing_balance" gorm:"column:closing_balance"`
	ExpectedBalance float64  `json:"expected_balance" gorm:"column:expected_balance"`
	Discrepancy    float64   `json:"discrepancy" gorm:"column:discrepancy"`
	Status         string    `json:"status" gorm:"column:status"` // OPEN, CLOSED
	ClientOpenedAt time.Time  `json:"client_opened_at,omitzero" gorm:"column:client_opened_at"`
	ClientClosedAt *time.Time `json:"client_closed_at,omitempty" gorm:"column:client_closed_at"`
	CreatedAt      time.Time  `json:"created_at,omitzero" gorm:"column:created_at"`
}

type Transaction struct {
	ID              string             `json:"id" gorm:"primaryKey;column:id"`
	ShiftID         string             `json:"shift_id" gorm:"column:shift_id"`
	OutletID        string             `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID      string             `json:"business_id" gorm:"column:business_id"`
	CustomerName    string             `json:"customer_name" gorm:"column:customer_name"`
	TotalAmount     float64            `json:"total_amount" gorm:"column:total_amount"`
	PaymentMethod   string             `json:"payment_method" gorm:"column:payment_method"`
	Status          string             `json:"status" gorm:"column:status"` // COMPLETED, CANCELLED
	CancelNotes     string             `json:"cancel_notes" gorm:"column:cancel_notes"`
	ClientCreatedAt time.Time          `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time          `json:"created_at,omitzero" gorm:"column:created_at"`
	Items           []*TransactionItem `json:"items,omitempty" gorm:"foreignKey:TransactionID"`
}

type TransactionItem struct {
	ID            string  `json:"id" gorm:"primaryKey;column:id"`
	TransactionID string  `json:"transaction_id" gorm:"column:transaction_id"`
	ProductID     string  `json:"product_id" gorm:"column:product_id"`
	Quantity      int     `json:"quantity" gorm:"column:quantity"`
	UnitPrice     float64 `json:"unit_price" gorm:"column:unit_price"`
}

type ProductWaste struct {
	ID              string    `json:"id" gorm:"primaryKey;column:id"`
	OutletID        string    `json:"outlet_id" gorm:"column:outlet_id"`
	BusinessID      string    `json:"business_id" gorm:"column:business_id"`
	StaffID         string    `json:"staff_id" gorm:"column:staff_id"`
	ProductID       string    `json:"product_id" gorm:"column:product_id"`
	Quantity        int       `json:"quantity" gorm:"column:quantity"`
	Reason          string    `json:"reason" gorm:"column:reason"`
	ClientCreatedAt time.Time `json:"client_created_at,omitzero" gorm:"column:client_created_at"`
	CreatedAt       time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

// Repositories
type POSRepository interface {
	SaveShift(ctx context.Context, shift *Shift) error
	GetShiftByID(ctx context.Context, id string) (*Shift, error)
	
	SaveTransaction(ctx context.Context, trx *Transaction) error
	GetTransactionByID(ctx context.Context, id string) (*Transaction, error)
	GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*Transaction, error)
	UpdateTransactionStatus(ctx context.Context, id, status, cancelNotes string) error
	
	SaveProductWaste(ctx context.Context, waste *ProductWaste) error
	GetProductWasteByID(ctx context.Context, id string) (*ProductWaste, error)
}

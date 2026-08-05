package domain

import "context"


type SyncUpRequest struct {
	Shifts       []*Shift          `json:"shifts"`
	Transactions []*Transaction    `json:"transactions"`
	Wastes       []*ProductWaste   `json:"wastes"`
}

type SyncUpResponse struct {
	ShiftsSynced       int `json:"shifts_synced"`
	TransactionsSynced int `json:"transactions_synced"`
	WastesSynced       int `json:"wastes_synced"`
	FailedTransactions []string `json:"failed_transactions,omitempty"`
}

type POSSyncService interface {
	GetMasterData(ctx context.Context, businessID, outletID string) (*SyncMasterDataResponse, error)
	SyncUp(ctx context.Context, businessID, outletID string, req *SyncUpRequest) (*SyncUpResponse, error)
	GetTransactions(ctx context.Context, outletID string, limit, offset int) ([]*Transaction, error)
}

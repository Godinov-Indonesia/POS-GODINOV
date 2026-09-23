package domain

import "context"

type DeviceBindRequest struct {
	SerialBusiness string `json:"serial_business"`
	SerialOutlet   string `json:"serial_outlet"`
	Password       string `json:"password"` // Business password

	// Scope perangkat — `POS` (bawaan) atau `OPNAME` ([11 §M16.1]).
	//
	// Ditentukan saat binding oleh teknisi pemasang, dan MELEKAT pada token
	// selama umur pemasangan. Perangkat gudang yang di-binding sebagai `OPNAME`
	// tidak akan pernah dapat memanggil `POST /v1/pos/sync` — token itulah yang
	// menolaknya, bukan UI.
	//
	// Kosong berarti `POS`, sehingga alur binding kasir yang sudah ada tidak
	// perlu berubah sama sekali.
	Scope string `json:"scope"`
}

type DeviceBindResponse struct {
	DeviceToken string `json:"device_token"`
}

type POSAuthService interface {
	BindDevice(ctx context.Context, req *DeviceBindRequest) (*DeviceBindResponse, error)
}

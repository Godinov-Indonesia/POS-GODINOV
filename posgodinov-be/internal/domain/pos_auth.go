package domain

import "context"

type DeviceBindRequest struct {
	SerialBusiness string `json:"serial_business"`
	SerialOutlet   string `json:"serial_outlet"`
	Password       string `json:"password"` // Business password
}

type DeviceBindResponse struct {
	DeviceToken string `json:"device_token"`
}

type POSAuthService interface {
	BindDevice(ctx context.Context, req *DeviceBindRequest) (*DeviceBindResponse, error)
}

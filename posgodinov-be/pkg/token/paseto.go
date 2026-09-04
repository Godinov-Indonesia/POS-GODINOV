package token

import (
	"time"

	"github.com/vk-rv/pvx"
)

type Payload struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Type     string `json:"type"`
	TenantID string `json:"tenant_id,omitempty"`
}

// TokenMaker manages PASETO tokens
type TokenMaker interface {
	CreateToken(payload Payload, duration time.Duration) (string, error)
	VerifyToken(token string) (*Payload, error)
}

type PasetoMaker struct {
	symmetricKey *pvx.SymKey
}

func NewPasetoMaker(symmetricKeyHex string) (TokenMaker, error) {
	// PASETO v4 local tokens require a 32-byte symmetric key.
	keyBytes := []byte(symmetricKeyHex)
	if len(keyBytes) != 32 {
		// Pad or truncate to exactly 32 bytes for simplicity
		padded := make([]byte, 32)
		copy(padded, keyBytes)
		keyBytes = padded
	}

	symKey := pvx.NewSymmetricKey(keyBytes, pvx.Version4)

	return &PasetoMaker{
		symmetricKey: symKey,
	}, nil
}

func (maker *PasetoMaker) CreateToken(payload Payload, duration time.Duration) (string, error) {
	pv := pvx.NewPV4Local()

	now := time.Now()
	exp := now.Add(duration)

	claims := pvx.RegisteredClaims{
		Expiration: &exp,
		IssuedAt:   &now,
	}

	customClaims := struct {
		pvx.RegisteredClaims
		Payload
	}{
		RegisteredClaims: claims,
		Payload:          payload,
	}

	return pv.Encrypt(maker.symmetricKey, &customClaims)
}

func (maker *PasetoMaker) VerifyToken(token string) (*Payload, error) {
	pv := pvx.NewPV4Local()

	var customClaims struct {
		pvx.RegisteredClaims
		Payload
	}

	err := pv.Decrypt(token, maker.symmetricKey).ScanClaims(&customClaims)
	if err != nil {
		return nil, err
	}

	return &customClaims.Payload, nil
}

package token

import (
	"time"

	"github.com/vk-rv/pvx"
)

type Payload struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Type     string `json:"type"`
	BusinessID string `json:"business_id,omitempty"`

	// Scope memisahkan perangkat KASIR dari perangkat OPNAME — butir 4
	// ([11 §M16.1]).
	//
	// ═══════════════════════════════════════════════════════════════════════
	// MENGAPA KLAIM TOKEN, BUKAN PEMERIKSAAN PERAN DI HANDLER
	// ═══════════════════════════════════════════════════════════════════════
	//
	// Pemisahan tugas yang hanya ditegakkan di UI runtuh begitu seseorang
	// memanggil endpoint-nya langsung. Klaim di dalam token berarti perangkat
	// gudang secara harfiah TIDAK MEMEGANG kredensial untuk menyentuh
	// `POST /v1/pos/sync` — bukan sekadar tidak diberi tombolnya.
	//
	// Kosong berarti `POS`: seluruh device token yang terbit sebelum butir 4
	// ada tetap sah untuk jalur kasir, dan tidak ada perangkat lapangan yang
	// perlu di-binding ulang. Perangkat opname harus MENYATAKAN dirinya, dan
	// pernyataan itu yang membatasinya.
	Scope string `json:"scope,omitempty"`
}

// Nilai [Payload.Scope] yang dikenal.
const (
	ScopePOS    = "POS"
	ScopeOpname = "OPNAME"
)

// EffectiveScope memperlakukan klaim kosong sebagai [ScopePOS].
//
// Dipakai SETIAP pemeriksaan scope. Menuliskan `payload.Scope == ""` di tempat
// pemanggil berarti perangkat lama akan ditolak oleh pemeriksaan pertama yang
// lupa menuliskannya.
func (p Payload) EffectiveScope() string {
	if p.Scope == "" {
		return ScopePOS
	}
	return p.Scope
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

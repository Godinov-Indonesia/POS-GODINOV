package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
)

// JSONB memetakan kolom PostgreSQL `JSONB` tanpa menambah dependensi baru.
//
// Nilainya disimpan mentah agar payload yang dikirim perangkat sampai ke basis
// data apa adanya. Untuk `pos_security_events.details` dan
// `void_logs.items_snapshot`, isinya memang tidak berbentuk tetap: perangkat
// versi lama harus tetap dapat mengirim konteks yang belum dikenal server tanpa
// gagal mengurai.
type JSONB json.RawMessage

// MarshalJSON menyalurkan nilai mentah, bukan membungkusnya sebagai string.
func (j JSONB) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSONB) UnmarshalJSON(data []byte) error {
	if j == nil {
		return errors.New("domain.JSONB: UnmarshalJSON pada penunjuk nil")
	}
	*j = append((*j)[0:0], data...)
	return nil
}

// Value menulis `NULL` untuk nilai kosong, bukan string kosong — string kosong
// bukan JSON yang sah dan akan ditolak kolom JSONB.
func (j JSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	if !json.Valid(j) {
		return nil, fmt.Errorf("domain.JSONB: bukan JSON yang sah: %s", string(j))
	}
	return string(j), nil
}

func (j *JSONB) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append((*j)[0:0], v...)
	case string:
		*j = append((*j)[0:0], v...)
	default:
		return fmt.Errorf("domain.JSONB: tipe sumber tidak didukung %T", src)
	}
	return nil
}

// StringList memetakan kolom `JSONB` yang berisi array string, mis.
// `users.permissions`.
type StringList []string

func (s StringList) Value() (driver.Value, error) {
	// Array kosong, BUKAN NULL: kolomnya `NOT NULL DEFAULT '[]'`, dan pembaca
	// yang menerima NULL harus menuliskan penjaga nil di setiap tempat.
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal([]string(s))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (s *StringList) Scan(src any) error {
	var raw []byte
	switch v := src.(type) {
	case nil:
		*s = StringList{}
		return nil
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return fmt.Errorf("domain.StringList: tipe sumber tidak didukung %T", src)
	}

	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return err
	}
	*s = out
	return nil
}

// Has memeriksa satu izin. Perbandingan bersifat sensitif huruf besar-kecil —
// kamus izin adalah kontrak beku, bukan teks bebas.
func (s StringList) Has(permission string) bool {
	for _, p := range s {
		if p == permission {
			return true
		}
	}
	return false
}

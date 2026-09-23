package utils

import (
	"crypto/rand"
	"encoding/hex"
)

// NewUUID menghasilkan UUID v4 (RFC 4122).
//
// # Mengapa ditulis sendiri, bukan menarik pustaka
//
// Kebutuhannya sempit dan tetap: satu-satunya baris yang UUID-nya dibuat SERVER
// adalah `product_wastes` turunan retur ([11 §M13.6]). Seluruh entitas lain
// memakai UUID buatan klien — itulah dasar idempotensi sinkronisasi (aturan
// R2), dan server tidak pernah membuatkannya.
//
// Menambah dependensi untuk dua puluh baris berarti menambah satu lagi hal yang
// harus diaudit, diperbarui, dan dipercaya pada rantai pasok yang menyentuh data
// keuangan.
//
// Memakai `crypto/rand`, bukan `math/rand`: id yang dapat ditebak pada baris
// audit memungkinkan seseorang menyusun tautan ke catatan pembuangan yang bukan
// miliknya.
func NewUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// `crypto/rand` hanya gagal bila sumber entropi sistem operasi rusak.
		// Melanjutkan dengan id yang lemah pada baris audit lebih buruk
		// daripada berhenti: id yang bertabrakan menimpa catatan pembuangan
		// yang lain.
		panic("utils.NewUUID: sumber entropi tidak tersedia: " + err.Error())
	}

	b[6] = (b[6] & 0x0f) | 0x40 // versi 4
	b[8] = (b[8] & 0x3f) | 0x80 // varian RFC 4122

	dst := make([]byte, 36)
	hex.Encode(dst[0:8], b[0:4])
	dst[8] = '-'
	hex.Encode(dst[9:13], b[4:6])
	dst[13] = '-'
	hex.Encode(dst[14:18], b[6:8])
	dst[18] = '-'
	hex.Encode(dst[19:23], b[8:10])
	dst[23] = '-'
	hex.Encode(dst[24:36], b[10:16])

	return string(dst)
}

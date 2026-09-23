/**
 * Konvensi uang — integer sen (ADR-05, docs/05 §1.8.1).
 *
 * Backend memetakan kolom DECIMAL ke `float64` di Go dan mengirimkannya sebagai
 * JSON number. Menyimpannya sebagai desimal di frontend berarti menumpuk galat
 * float di atas galat float. Seluruh state internal — keranjang, total,
 * kembalian, saldo shift — beroperasi pada **integer sen** dan bersifat eksak.
 *
 * TITIK KONVERSI — hanya tiga tempat:
 * | Arah            | Lokasi                                                    |
 * |-----------------|-----------------------------------------------------------|
 * | API → sen       | `lib/sync/master-sync.ts`, `lib/api/endpoints/*`           |
 * | sen → API       | `lib/sync/wire.ts`, form Admin saat submit                 |
 * | sen → tampilan  | `formatIdr()`                                             |
 */

/** Rupiah desimal (dari/ke API) → integer sen (state internal). */
export const toMinor = (major: number): number => Math.round(major * 100)

/** Integer sen → Rupiah desimal (untuk dikirim ke API). */
export const toMajor = (minor: number): number => minor / 100

/**
 * Integer sen → string Rupiah siap tampil, mis. `"Rp22.000"`.
 *
 * Sen tidak pernah ditampilkan ([06 §2.5]): harga ritel Indonesia tidak
 * mengenal pecahan sen, dan menampilkannya hanya menambah lebar kolom.
 */
export const formatIdr = (minor: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100)

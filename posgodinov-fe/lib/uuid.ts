/**
 * UUID v4 — docs/05 §1.5.1.
 *
 * UUID dibuat **sekali** saat entitas lahir dan tidak pernah diregenerasi.
 * Inilah dasar idempotensi backend (`ON CONFLICT (id) DO NOTHING`); regenerasi
 * saat kirim ulang berarti duplikasi data keuangan.
 */

/**
 * `crypto.randomUUID()` hanya tersedia pada *secure context* (HTTPS atau
 * localhost). Perangkat POS yang dilayani lewat HTTP di jaringan lokal tidak
 * mendapatkannya, sehingga fallback berbasis `crypto.getRandomValues` wajib ada
 * — tanpa itu, seluruh alur transaksi mati di perangkat tersebut.
 */
export function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versi 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // varian RFC 4122

  const hex: string[] = []
  for (let i = 0; i < 16; i += 1) hex.push(bytes[i].toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

/**
 * Encoder ESC/POS — docs/05 §1.7.1.
 *
 * ⚠️ **Karakter Indonesia.** Nama produk kerap memuat karakter di luar ASCII
 * ("Crème", "Piña"). Dukungan code page sangat bervariasi antar-merek printer
 * termal murah, dan salah code page menghasilkan sampah di kertas. Karena itu
 * renderer **mentransliterasi** ke ASCII alih-alih mengandalkan code page —
 * "é → e" selalu terbaca, "Ã©" tidak pernah.
 */

const ESC = 0x1b
const GS = 0x1d

export const ESCPOS = {
  /** ESC @ — reset printer ke keadaan awal. */
  INIT: new Uint8Array([ESC, 0x40]),
  /** ESC t 0 — CP437. Dipilih karena paling universal ([05 §1.7.1]). */
  CODEPAGE_CP437: new Uint8Array([ESC, 0x74, 0x00]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([GS, 0x21, 0x01]),
  NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),
  /** GS V 1 — potong kertas sebagian. */
  CUT: new Uint8Array([GS, 0x56, 0x01]),
  FEED: (lines: number) => new Uint8Array([ESC, 0x64, lines]),
} as const

/**
 * Transliterasi ke ASCII yang dapat dicetak.
 *
 * `normalize('NFD')` memisahkan huruf dari tanda diakritik, sehingga tanda itu
 * dapat dibuang tanpa daftar pemetaan manual. Karakter yang tersisa di luar
 * ASCII diganti `?` — lebih jujur daripada dihilangkan diam-diam.
 */
export function toAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '?')
}

export function encodeText(text: string): Uint8Array {
  const ascii = toAscii(text)
  const bytes = new Uint8Array(ascii.length)
  for (let i = 0; i < ascii.length; i += 1) bytes[i] = ascii.charCodeAt(i) & 0xff
  return bytes
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Baris dua kolom: label rata kiri, nilai rata kanan, dipisah spasi. */
export function twoColumns(left: string, right: string, columns: number): string {
  const l = toAscii(left)
  const r = toAscii(right)
  const gap = Math.max(1, columns - l.length - r.length)
  return `${l}${' '.repeat(gap)}${r}\n`
}

/** Memotong teks yang melebihi lebar kolom agar tidak membungkus tak terkendali. */
export function truncate(text: string, columns: number): string {
  const ascii = toAscii(text)
  return ascii.length <= columns ? ascii : `${ascii.slice(0, columns - 1)}~`
}

export const divider = (columns: number): string => `${'-'.repeat(columns)}\n`

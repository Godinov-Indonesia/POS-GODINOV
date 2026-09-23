import { z } from 'zod'

/**
 * Aturan isian tender kartu — **butir 8** ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA LAPIS, SATU RUMUS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. LAYAR    — berkas ini, dipakai `PaymentCardScreen`
 *   2. KAWAT    — `assertTenderIntegrity()` di `lib/sync/wire.ts`
 *   3. BASIS DATA — `CHECK ck_card_requires_trace` di PostgreSQL
 *
 * Ketiganya diperlukan, dan bukan karena paranoia berlebih. Lapis 1 memberi
 * kasir pesan yang dapat ditindaklanjuti SEBELUM uang berpindah. Lapis 2
 * menangkap baris yang lahir dari jalur lain — impor, migrasi, perangkat yang
 * dimodifikasi. Lapis 3 adalah kebenaran terakhir yang tidak dapat dilewati
 * siapa pun.
 *
 * Yang dijaga berkas ini adalah agar ketiganya memakai rumus yang SAMA. Regex
 * yang disalin ke tiga tempat akan berbeda pada perbaikan pertama.
 *
 * ⛔ **DILARANG** menambahkan PAN penuh, CVV, PIN, atau data magstripe ke tipe
 * mana pun di sini (aturan R8). Menyimpannya memindahkan seluruh sistem ke
 * ruang lingkup PCI-DSS penuh — konsekuensi hukum dan biaya audit yang tidak
 * dapat ditarik kembali setelah satu baris tersimpan.
 */

/**
 * Panjang minimum trace number.
 *
 * Mesin EDC Indonesia menerbitkan trace number 6 digit; sebagian bank memakai
 * 12. Batas bawah 4 sengaja LEBIH LONGGAR dari 6: menolak trace number yang
 * sah karena bank tertentu memakai format lain berarti kasir tidak dapat
 * menyelesaikan transaksi yang uangnya sudah tergesek.
 *
 * Yang benar-benar ditegakkan adalah **ada isinya**, bukan formatnya. Yang
 * memverifikasi trace number adalah struk EDC di tangan kasir, bukan aplikasi.
 */
export const TRACE_NUMBER_MIN_LENGTH = 4
export const TRACE_NUMBER_MAX_LENGTH = 20

/** Tepat 4 digit — cerminan `card_last4 CHAR(4)`. */
export const CARD_LAST4_PATTERN = /^[0-9]{4}$/

export const traceNumberSchema = z
  .string()
  .trim()
  .min(TRACE_NUMBER_MIN_LENGTH, `Trace number minimal ${TRACE_NUMBER_MIN_LENGTH} karakter.`)
  .max(TRACE_NUMBER_MAX_LENGTH, `Trace number maksimal ${TRACE_NUMBER_MAX_LENGTH} karakter.`)

export const cardLast4Schema = z
  .string()
  .trim()
  .regex(CARD_LAST4_PATTERN, '4 digit akhir kartu harus tepat 4 angka.')

/** Hasil validasi satu isian, siap ditampilkan di bawah kolomnya. */
export type CardFieldError = string | null

/**
 * Memvalidasi trace number. `null` berarti sah.
 *
 * Mengembalikan pesan alih-alih melempar: layar perlu menampilkannya di bawah
 * kolom yang salah, dan pengecualian tidak membawa informasi kolom mana.
 */
export function validateTraceNumber(value: string): CardFieldError {
  const result = traceNumberSchema.safeParse(value)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Trace number tidak sah.')
}

export function validateCardLast4(value: string): CardFieldError {
  const result = cardLast4Schema.safeParse(value)
  return result.success ? null : (result.error.issues[0]?.message ?? '4 digit akhir tidak sah.')
}

/**
 * Menyaring input menjadi angka saja.
 *
 * Dipakai `onChange`, bukan hanya saat submit. Menolak karakter pada saat
 * diketik jauh lebih jelas daripada menampilkan galat setelah kasir selesai
 * mengetik dua belas karakter — terutama karena sebagian pemindai kartu
 * mengirimkan karakter kontrol yang tidak terlihat.
 */
export const digitsOnly = (value: string): string => value.replace(/\D/g, '')

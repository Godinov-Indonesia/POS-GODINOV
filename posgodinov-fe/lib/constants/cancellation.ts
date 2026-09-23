/**
 * Kamus pembatalan — **KONTRAK BEKU** lintas platform ([11 §3.5]).
 *
 * Nilai-nilai ini masuk ke `void_logs.reason_code`, `returns.reason_code`, dan
 * `return_items.waste_reason_code`. Sama seperti `payment.ts`, mengubah atau
 * mengganti nama salah satunya SETELAH produksi berjalan memecah seluruh
 * laporan kecurangan secara permanen — dan laporan kecurangan justru satu-
 * satunya alasan kamus ini ada.
 *
 * Wajib identik huruf demi huruf dengan `ReasonCodes` di
 * `posgodinov-mobile/lib/core/config/constants.dart`.
 */

export const VOID_REASON_CODES = [
  'CUSTOMER_CANCEL',
  'WRONG_ITEM',
  'WRONG_QTY',
  'PRICE_DISPUTE',
  'TRAINING',
  'SYSTEM_ERROR',
  'DUPLICATE_ENTRY',
  'OTHER',
] as const

export const RETURN_REASON_CODES = [
  'DEFECTIVE',
  'WRONG_ITEM_DELIVERED',
  'CUSTOMER_CHANGED_MIND',
  'EXPIRED',
  'SIZE_EXCHANGE',
  'OTHER',
] as const

export const WASTE_REASON_CODES = [
  'EXPIRED',
  'SPOILED',
  'BROKEN',
  'SPILLED',
  'STAFF_MEAL',
  'SAMPLE_TASTING',
  'PRODUCTION_ERROR',
  'OTHER',
] as const

export type VoidReasonCode = (typeof VOID_REASON_CODES)[number]
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number]
export type WasteReasonCode = (typeof WASTE_REASON_CODES)[number]

/** Metode pengembalian — cerminan `returns.refund_method` ([11 §3.2]). */
export const REFUND_METHODS = [
  'CASH',
  'CARD_REVERSAL',
  'QRIS_REVERSAL',
  'EXCHANGE',
  'STORE_CREDIT',
] as const

export type RefundMethodCode = (typeof REFUND_METHODS)[number]

export const REFUND_METHOD_LABELS: Record<RefundMethodCode, string> = {
  CASH: 'Tunai',
  CARD_REVERSAL: 'Pembatalan Kartu',
  QRIS_REVERSAL: 'Pembatalan QRIS',
  EXCHANGE: 'Tukar Barang',
  STORE_CREDIT: 'Kredit Toko',
}

export const OTHER_REASON = 'OTHER'

/**
 * Panjang minimum catatan bila `reason_code === 'OTHER'`.
 *
 * Tanpa aturan ini seluruh kamus runtuh menjadi `OTHER` dalam dua minggu — jalur
 * yang paling sedikit gesekannya selalu menang — dan laporan kecurangan
 * kehilangan seluruh dayanya.
 */
export const OTHER_NOTES_MIN_LENGTH = 10

export const VOID_REASON_LABELS: Record<VoidReasonCode, string> = {
  CUSTOMER_CANCEL: 'Pelanggan membatalkan',
  WRONG_ITEM: 'Item salah',
  WRONG_QTY: 'Jumlah salah',
  PRICE_DISPUTE: 'Selisih harga',
  TRAINING: 'Latihan / uji coba',
  SYSTEM_ERROR: 'Kesalahan sistem',
  DUPLICATE_ENTRY: 'Input ganda',
  OTHER: 'Lainnya',
}

export const RETURN_REASON_LABELS: Record<ReturnReasonCode, string> = {
  DEFECTIVE: 'Barang rusak',
  WRONG_ITEM_DELIVERED: 'Salah barang diserahkan',
  CUSTOMER_CHANGED_MIND: 'Pelanggan berubah pikiran',
  EXPIRED: 'Kedaluwarsa',
  SIZE_EXCHANGE: 'Tukar ukuran',
  OTHER: 'Lainnya',
}

export const WASTE_REASON_LABELS: Record<WasteReasonCode, string> = {
  EXPIRED: 'Kedaluwarsa',
  SPOILED: 'Basi / rusak',
  BROKEN: 'Pecah / patah',
  SPILLED: 'Tumpah',
  STAFF_MEAL: 'Konsumsi staf',
  SAMPLE_TASTING: 'Sampel / tester',
  PRODUCTION_ERROR: 'Kesalahan produksi',
  OTHER: 'Lainnya',
}

/**
 * Ambang penurunan kuantitas yang memaksa alur Void — **butir 5**.
 *
 * Nilai bawaan. Sumber sesungguhnya adalah `config.void_threshold_qty` dari
 * master data ([11 §4.4]) agar pemilik dapat mengubahnya tanpa merilis ulang
 * tiga aplikasi; angka ini dipakai hanya bila perangkat belum pernah menarik
 * master v2.
 */
export const VOID_THRESHOLD_QTY = 5

/**
 * Apakah sebuah alasan sah beserta catatannya.
 *
 * Dipakai form Void maupun form Retur — keduanya tunduk pada aturan `OTHER`
 * yang sama.
 */
export function isReasonComplete(reasonCode: string, notes: string): boolean {
  if (!reasonCode) return false
  if (reasonCode !== OTHER_REASON) return true
  return notes.trim().length >= OTHER_NOTES_MIN_LENGTH
}

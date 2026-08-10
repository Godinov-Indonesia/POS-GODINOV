import { z } from 'zod'

/**
 * ⚠️ KONTRAK BEKU — docs/05-frontend-architecture-design.md §3.3.
 *
 * Nilai-nilai ini masuk ke kolom `transactions.payment_method` yang bertipe
 * VARCHAR(50) bebas, tanpa enum di sisi database ([02 §2.12]). Backend akan
 * menerima string apa pun. Mengubah, mengganti nama, atau menghapus salah
 * satunya SETELAH produksi berjalan akan memecah seluruh laporan historis —
 * tidak ada endpoint untuk memperbaiki data lama. Penambahan nilai baru harus
 * disepakati lintas tim (Web, Flutter, Backend, Analitik) sebelum dirilis.
 *
 * Terakhir disepakati: [ISI TANGGAL] — [ISI NAMA PENYETUJU]
 */
export const PAYMENT_METHODS = ['CASH', 'QRIS', 'DEBIT', 'TRANSFER'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  DEBIT: 'Kartu Debit',
  TRANSFER: 'Transfer Bank',
}

/** Hanya CASH yang memengaruhi `expected_balance` saat tutup shift ([04 §A.3]). */
export const CASH_METHODS: readonly PaymentMethod[] = ['CASH']

/** Penegakan runtime — dijalankan sebelum menulis ke Dexie dan sebelum sync. */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)

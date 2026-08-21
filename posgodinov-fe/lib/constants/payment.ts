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
 *
 * ══════════════════════════════════════════════════════════════════════════
 * v2 (M11.4) — TIGA DAFTAR, BUKAN SATU
 * ══════════════════════════════════════════════════════════════════════════
 *
 * v1 memakai satu array untuk tiga peran sekaligus: nilai yang sah di kolom
 * server, nilai yang boleh dipilih kasir, dan nilai yang muncul di laporan.
 * Multi-tender ([11 §3.2] tabel `transaction_payments`) memisahkan ketiganya
 * karena `SPLIT` **bukan** cara membayar — ia adalah ringkasan atas dua tender
 * atau lebih. Menaruhnya di daftar yang sama dengan `CASH` berarti kasir dapat
 * memilih "Split" sebagai metode, lalu tidak ada satu pun baris tender yang
 * lahir untuk menjelaskannya.
 *
 * | Daftar                    | Peran                                            |
 * |---------------------------|--------------------------------------------------|
 * | `PAYMENT_METHODS`         | Yang dirender pemilih metode kasir hari ini      |
 * | `TENDER_METHODS`          | Yang sah di `transaction_payments.method`        |
 * | `PAYMENT_SUMMARY_METHODS` | Yang sah di `transactions.payment_method`        |
 */

/**
 * Daftar v1 — **sengaja tidak berubah**.
 *
 * `PaymentScreen` merender pemilih metode dari array ini
 * ([05 §3.3]: "Metode pembayaran **hanya** dirender dari `PAYMENT_METHODS.map(...)`").
 * `CREDIT` baru muncul di layar setelah M17.2 membangun form kartu; menambahkannya
 * ke sini sekarang akan memunculkan tombol yang alur pembayarannya belum ada.
 */
export const PAYMENT_METHODS = ['CASH', 'QRIS', 'DEBIT', 'TRANSFER'] as const

/**
 * Nilai sah untuk **satu baris tender** (`transaction_payments.method`).
 *
 * `CREDIT` dipisah dari `DEBIT` karena keduanya memiliki jalur settlement dan
 * biaya MDR yang berbeda; menggabungkannya membuat rekonsiliasi EDC saat Blind
 * Closing ([11 §M15.3]) tidak dapat dipisahkan lagi setelah datanya tertulis.
 */
export const TENDER_METHODS = ['CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER'] as const

/**
 * Nilai sah untuk **ringkasan** di `transactions.payment_method`.
 *
 * `SPLIT` hanya boleh muncul bila `payments.length > 1`; penegakannya ada di
 * `assertTenderIntegrity()` (`lib/sync/wire.ts`).
 */
export const PAYMENT_SUMMARY_METHODS = [...TENDER_METHODS, 'SPLIT'] as const

/** Satu cara membayar. Inilah tipe `LocalPayment.method`. */
export type PaymentMethod = (typeof TENDER_METHODS)[number]

/** Ringkasan pembayaran satu transaksi. Inilah tipe `LocalTransaction.payment_method`. */
export type PaymentSummaryMethod = (typeof PAYMENT_SUMMARY_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentSummaryMethod, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  DEBIT: 'Kartu Debit',
  CREDIT: 'Kartu Kredit',
  TRANSFER: 'Transfer Bank',
  SPLIT: 'Gabungan',
}

/**
 * Hanya CASH yang memengaruhi `expected_balance` saat tutup shift ([04 §A.3]).
 *
 * Bertipe `PaymentSummaryMethod[]` agar `shift-math` dapat memeriksanya langsung
 * terhadap `transaction.payment_method` yang kini dapat bernilai `SPLIT`.
 * Transaksi `SPLIT` **tidak** dihitung dari kolom ringkasan — porsi tunainya
 * dijumlahkan per baris tender ([11 §M15.3]).
 */
export const CASH_METHODS: readonly PaymentSummaryMethod[] = ['CASH']

/**
 * Metode yang **wajib** membawa `trace_number` + `card_last4` (butir 8).
 *
 * Cerminan `CHECK ck_card_requires_trace` di PostgreSQL ([11 §3.2]).
 */
export const CARD_METHODS: readonly PaymentMethod[] = ['DEBIT', 'CREDIT']

export const isCardMethod = (method: PaymentMethod): boolean => CARD_METHODS.includes(method)

/** Penegakan runtime untuk satu baris tender — dijalankan sebelum menulis ke Dexie. */
export const paymentMethodSchema = z.enum(TENDER_METHODS)

/** Penegakan runtime untuk kolom ringkasan — dijalankan sebelum sync. */
export const paymentSummaryMethodSchema = z.enum(PAYMENT_SUMMARY_METHODS)

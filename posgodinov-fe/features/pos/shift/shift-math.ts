/**
 * Aritmetika shift — docs/04 §A.3.
 *
 * Fungsi murni, seluruhnya beroperasi pada **integer sen** dan bersifat eksak.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ DIKELUARKAN DARI JALUR UI PADA M15.3 (butir 9)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sejak Blind Closing, `calculateExpectedBalance` dan `calculateDiscrepancy`
 * **tidak boleh dipanggil dari layar mana pun**. Wewenangnya pindah ke
 * `ShiftReconcileService` di server (aturan R3/R4): angka ekspektasi tidak
 * pernah dikirim ke perangkat kasir, dan tidak pernah diterima darinya.
 *
 * Larangannya ditegakkan `no-restricted-imports` pada `CloseShiftScreen.tsx`
 * di `eslint.config.mjs`, bukan hanya oleh catatan ini.
 *
 * Berkas ini SENGAJA tidak dihapus. Dua alasan:
 *
 *   1. `summarizeShift` masih dipakai untuk hal yang bukan kas — dan rumus yang
 *      dihapus lalu diketik ulang di tempat lain jauh lebih berbahaya daripada
 *      rumus yang tinggal di satu tempat dengan larangan yang jelas.
 *   2. `config.blind_close_enabled === false` adalah mode yang dijanjikan
 *      ([11 §M15.3]): pemilik yang mematikan Blind Closing membutuhkan rumus
 *      ini kembali. Ia hanya boleh dipanggil di balik gerbang itu, dan tidak
 *      pernah dari `CloseShiftScreen`.
 */

import { CASH_METHODS, type PaymentSummaryMethod } from '@/lib/constants/payment'
import type { TransactionStatus } from '@/lib/types/api'

/**
 * Status yang **tidak** menghasilkan uang di laci.
 *
 * `VOIDED` (v2) dan `CANCELLED` (warisan v1) harus diperlakukan identik di
 * sini. Melewatkan `VOIDED` berarti transaksi yang dibatalkan ikut terhitung
 * sebagai penjualan tunai — selisih kas yang harus dipertanggungjawabkan kasir
 * di akhir shift ([11 §2.4]).
 */
const CANCELLED_STATUSES: readonly TransactionStatus[] = ['VOIDED', 'CANCELLED']

export type ShiftMathInput = {
  /** Modal awal laci dalam sen. */
  openingBalanceMinor: number
  transactions: {
    payment_method: PaymentSummaryMethod
    status: TransactionStatus
    total_amount: number
  }[]
}

/**
 * `expected_balance = opening_balance + Σ(transaksi COMPLETED bermetode CASH)`.
 *
 * Hanya CASH yang memengaruhi isi laci — QRIS, DEBIT, dan TRANSFER tidak pernah
 * menambah uang fisik. Transaksi `CANCELLED` dikeluarkan karena uangnya
 * dikembalikan ke pelanggan.
 */
export function calculateExpectedBalance(input: ShiftMathInput): number {
  return input.transactions.reduce((sum, transaction) => {
    if (transaction.status !== 'COMPLETED') return sum
    if (!CASH_METHODS.includes(transaction.payment_method)) return sum
    return sum + transaction.total_amount
  }, input.openingBalanceMinor)
}

/** Negatif = uang fisik kurang dari seharusnya. */
export const calculateDiscrepancy = (
  closingBalanceMinor: number,
  expectedBalanceMinor: number,
): number => closingBalanceMinor - expectedBalanceMinor

export type ShiftSummary = {
  expectedBalanceMinor: number
  cashSalesMinor: number
  nonCashSalesMinor: number
  completedCount: number
  cancelledCount: number
}

export function summarizeShift(input: ShiftMathInput): ShiftSummary {
  let cashSalesMinor = 0
  let nonCashSalesMinor = 0
  let completedCount = 0
  let cancelledCount = 0

  for (const transaction of input.transactions) {
    if (CANCELLED_STATUSES.includes(transaction.status)) {
      cancelledCount += 1
      continue
    }
    completedCount += 1
    if (CASH_METHODS.includes(transaction.payment_method)) cashSalesMinor += transaction.total_amount
    else nonCashSalesMinor += transaction.total_amount
  }

  return {
    expectedBalanceMinor: input.openingBalanceMinor + cashSalesMinor,
    cashSalesMinor,
    nonCashSalesMinor,
    completedCount,
    cancelledCount,
  }
}

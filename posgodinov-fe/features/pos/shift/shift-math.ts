/**
 * Aritmetika shift — docs/04 §A.3.
 *
 * Fungsi murni, seluruhnya beroperasi pada **integer sen** dan bersifat eksak.
 *
 * ⚠️ Server **tidak** menghitung ulang nilai-nilai ini, padahal `discrepancy`
 * inilah yang muncul di dashboard pemilik sebagai indikator selisih kas
 * ([02 §2.11]). Rumus di sini harus benar.
 */

import { CASH_METHODS, type PaymentMethod } from '@/lib/constants/payment'

export type ShiftMathInput = {
  /** Modal awal laci dalam sen. */
  openingBalanceMinor: number
  transactions: { payment_method: PaymentMethod; status: 'COMPLETED' | 'CANCELLED'; total_amount: number }[]
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
    if (transaction.status === 'CANCELLED') {
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

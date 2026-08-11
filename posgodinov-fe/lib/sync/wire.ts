/**
 * Konversi baris lokal → payload kawat — docs/05 §1.6.3 & §3.3.
 *
 * Jaring pengaman terakhir sebelum data meninggalkan perangkat. Tiga hal yang
 * terjadi di sini dan tidak boleh terjadi di tempat lain:
 * 1. **Membuang metadata lokal** (seluruh field berprefiks `_`).
 * 2. **Mengonversi sen → Rupiah desimal** (ADR-05).
 * 3. **Memvalidasi `payment_method`** — melempar bila ada nilai tak sah yang
 *    lolos. Lebih baik sinkronisasi gagal keras daripada mencemari laporan
 *    selamanya; tidak ada endpoint untuk memperbaiki data lama.
 */

import { paymentMethodSchema } from '@/lib/constants/payment'
import type { LocalShift, LocalTransaction, LocalWaste } from '@/lib/db/models'
import { toMajor } from '@/lib/money'
import type { ShiftPayload, TransactionPayload, WastePayload } from '@/lib/types/api'

/**
 * Pembuangan field lokal secara **mekanis**, bukan lewat daftar manual.
 * Menambah field lokal baru tidak menuntut siapa pun mengingat berkas ini.
 */
const stripLocal = <T extends object>(row: T): Partial<T> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_'))) as Partial<T>

export const toWireShift = (shift: LocalShift): ShiftPayload => {
  return {
    id: shift.id,
    staff_id: shift.staff_id,
    opening_balance: toMajor(shift.opening_balance),
    closing_balance: toMajor(shift.closing_balance),
    expected_balance: toMajor(shift.expected_balance),
    discrepancy: toMajor(shift.discrepancy),
    status: shift.status,
    client_opened_at: shift.client_opened_at,
    client_closed_at: shift.client_closed_at,
  } as ShiftPayload
}

export const toWireTransaction = (transaction: LocalTransaction): TransactionPayload => {
  // Melempar bila entah bagaimana ada nilai tak sah yang lolos ke Dexie.
  paymentMethodSchema.parse(transaction.payment_method)

  return {
    id: transaction.id,
    shift_id: transaction.shift_id,
    customer_name: transaction.customer_name || "",
    total_amount: toMajor(transaction.total_amount),
    payment_method: transaction.payment_method,
    status: transaction.status,
    cancel_notes: transaction.cancel_notes || "",
    client_created_at: transaction.client_created_at,
    items: transaction.items.map((item) => ({
      id: item.id,
      transaction_id: transaction.id,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: toMajor(item.unit_price),
    })),
  } as TransactionPayload
}

export const toWireWaste = (waste: LocalWaste): WastePayload => stripLocal(waste) as WastePayload

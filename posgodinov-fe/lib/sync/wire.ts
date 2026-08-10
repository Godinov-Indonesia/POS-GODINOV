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
  const bare = stripLocal(shift)
  return {
    ...bare,
    opening_balance: toMajor(shift.opening_balance),
    closing_balance: toMajor(shift.closing_balance),
    expected_balance: toMajor(shift.expected_balance),
    discrepancy: toMajor(shift.discrepancy),
  } as ShiftPayload
}

export const toWireTransaction = (transaction: LocalTransaction): TransactionPayload => {
  // Melempar bila entah bagaimana ada nilai tak sah yang lolos ke Dexie.
  paymentMethodSchema.parse(transaction.payment_method)

  const bare = stripLocal(transaction)

  return {
    ...bare,
    total_amount: toMajor(transaction.total_amount),
    items: transaction.items.map((item) => ({
      ...stripLocal(item),
      unit_price: toMajor(item.unit_price),
    })),
    // `business_id` / `outlet_id` sengaja TIDAK dikirim — backend menimpanya
    // paksa dari device token ([03 §2.3]).
  } as TransactionPayload
}

export const toWireWaste = (waste: LocalWaste): WastePayload => stripLocal(waste) as WastePayload

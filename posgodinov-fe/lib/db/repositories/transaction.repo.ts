/**
 * Transaksi & waste produk lokal — docs/05 §1.5.1 & §1.6.5.
 *
 * DUA ATURAN YANG TIDAK BOLEH DILANGGAR:
 * - **Baris tidak pernah dihapus** setelah tersinkron. Riwayat "Hari Ini"
 *   dibaca dari lokal ([04 §A.5]), dan menghapus baris keuangan adalah cara
 *   tercepat kehilangan jejak audit.
 * - **UUID tidak pernah diregenerasi.** Idempotensi backend bersandar penuh
 *   pada `id` yang stabil (`ON CONFLICT (id) DO NOTHING`).
 */

import { db } from '@/lib/db/dexie'
import type { LocalTransaction, LocalTransactionItem, LocalWaste } from '@/lib/db/models'
import { paymentMethodSchema, type PaymentMethod } from '@/lib/constants/payment'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

export async function saveTransaction(params: {
  shiftId: string
  customerName: string
  totalAmountMinor: number
  paymentMethod: PaymentMethod
  items: Omit<LocalTransactionItem, 'id' | 'transaction_id'>[]
  cashReceivedMinor?: number
  changeMinor?: number
}): Promise<LocalTransaction> {
  // Penegakan runtime sebelum menulis ke Dexie ([05 §3.3 butir 2]) — menangkap
  // nilai rusak sebelum ia mencemari laporan secara permanen.
  paymentMethodSchema.parse(params.paymentMethod)

  const id = newUuid()

  const transaction: LocalTransaction = {
    id,
    shift_id: params.shiftId,
    customer_name: params.customerName,
    total_amount: params.totalAmountMinor,
    payment_method: params.paymentMethod,
    status: 'COMPLETED',
    cancel_notes: '',
    client_created_at: nowIso(),
    items: params.items.map((item) => ({ ...item, id: newUuid(), transaction_id: id })),
    _cash_received: params.cashReceivedMinor,
    _change: params.changeMinor,
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.transactions.add(transaction)
  return transaction
}

/**
 * Void — dikirim sebagai transaksi ber-`id` sama berstatus `CANCELLED`.
 *
 * Bila server sudah menyimpannya sebagai `COMPLETED`, server akan mengembalikan
 * bahan baku ke inventori (*reverse deduction*) lalu memperbarui status
 * ([03 §2.3]). Karena itu baris tidak dihapus, hanya ditandai dan diantrekan
 * ulang (`_synced = 0`).
 */
export async function voidTransaction(id: string, cancelNotes: string): Promise<void> {
  await db.transactions.update(id, {
    status: 'CANCELLED',
    cancel_notes: cancelNotes,
    _synced: 0,
    _syncError: null,
  })
}

export const getTransaction = (id: string): Promise<LocalTransaction | undefined> =>
  db.transactions.get(id)

/** Riwayat satu shift, terbaru dulu. Memakai indeks komposit `[shift_id+status]`. */
export async function listTransactionsByShift(shiftId: string): Promise<LocalTransaction[]> {
  const rows = await db.transactions.where('shift_id').equals(shiftId).toArray()
  return rows.sort((a, b) => b.client_created_at.localeCompare(a.client_created_at))
}

/** Riwayat "Hari Ini" dibaca dari lokal, bukan dari server ([04 §A.5]). */
export async function listTransactionsToday(): Promise<LocalTransaction[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const cutoff = startOfDay.toISOString()

  const rows = await db.transactions.where('client_created_at').aboveOrEqual(cutoff).toArray()
  return rows.sort((a, b) => b.client_created_at.localeCompare(a.client_created_at))
}

export const countUnsyncedTransactions = (): Promise<number> =>
  db.transactions.where('_synced').equals(0).count()

export const listFailedTransactions = (): Promise<LocalTransaction[]> =>
  db.transactions.filter((t) => t._synced === 0 && t._syncAttempts > 0).toArray()

/* ── Waste produk jadi (sisi kasir) ───────────────────────────────────────── */

export async function saveWaste(params: {
  staffId: string
  productId: string
  productName: string
  quantity: number
  reason: string
}): Promise<LocalWaste> {
  const waste: LocalWaste = {
    id: newUuid(),
    staff_id: params.staffId,
    product_id: params.productId,
    quantity: params.quantity,
    reason: params.reason,
    client_created_at: nowIso(),
    _product_name: params.productName,
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.wastes.add(waste)
  return waste
}

export const countUnsyncedWastes = (): Promise<number> =>
  db.wastes.where('_synced').equals(0).count()

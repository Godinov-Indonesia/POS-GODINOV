/**
 * Retur — butir 15 ([11 §3.2]).
 *
 * Retur adalah **peristiwa keuangan baru**, bukan perubahan atas transaksi
 * asal. Transaksi asal tetap `COMPLETED` selamanya; hanya kolom turunan
 * `return_state` yang berubah — dan itu pun dihitung server ([11 §2.1]).
 */

import { getBoundOutletLabel } from '@/lib/auth/device-session'
import { db } from '@/lib/db/dexie'
import type { LocalReturn, LocalReturnItem } from '@/lib/db/models'
import { enqueueReturnReceipt } from '@/lib/printer/print-queue'
import { notifyCommit } from '@/lib/sync/commit-notifier'
import { nowIso } from '@/lib/time'
import type { RefundMethod, ReturnKind } from '@/lib/types/api'
import { newUuid } from '@/lib/uuid'

export type SaveReturnParams = {
  originalTransactionId: string
  /** Shift **saat retur terjadi** — sengaja dapat berbeda dari shift asal. */
  shiftId: string
  staffId: string
  authorizedBy?: string | null
  refundMethod: RefundMethod
  reasonCode: string
  reasonNotes?: string
  items: Omit<LocalReturnItem, 'id'>[]
  /** Kuantitas asli per baris — penentu `FULL` vs `PARTIAL`. */
  originalQuantities: Readonly<Record<string, number>>

  /* ── Konteks struk retur ([11 §M14.4]) ────────────────────────────────── */

  /** Kode struk penjualan asli, untuk dicetak. */
  originalCode?: string
  cashierName?: string
  authorizedByName?: string
  refundMethodLabel?: string
}

/**
 * Menyimpan retur beserta itemnya.
 *
 * ⚠️ `refund_amount` **dihitung di sini**, bukan diterima dari UI. Nilai yang
 * datang dari layar dapat menyimpang dari item yang benar-benar dipilih — mis.
 * ketika kasir mengubah kuantitas setelah nominalnya terlanjur dihitung — dan
 * selisihnya baru terlihat saat rekonsiliasi kas.
 */
export async function saveReturn(params: SaveReturnParams): Promise<LocalReturn> {
  if (params.items.length === 0) {
    throw new Error('Retur tanpa item bukan retur.')
  }

  const items: LocalReturnItem[] = params.items.map((item) => ({
    ...item,
    id: newUuid(),
  }))

  const refundAmount = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  // FULL hanya bila SETIAP baris asli diretur habis dalam satu retur ini.
  // Menghitungnya dari total kuantitas saja akan menandai "2 dari item A +
  // 0 dari item B" sebagai FULL ketika kebetulan jumlahnya cocok.
  const returnType: ReturnKind = isFullReturn(items, params.originalQuantities)
    ? 'FULL'
    : 'PARTIAL'

  const ret: LocalReturn = {
    id: newUuid(),
    original_transaction_id: params.originalTransactionId,
    shift_id: params.shiftId,
    staff_id: params.staffId,
    authorized_by: params.authorizedBy ?? null,
    return_type: returnType,
    refund_method: params.refundMethod,
    refund_amount: refundAmount,
    reason_code: params.reasonCode,
    reason_notes: params.reasonNotes ?? '',
    // Ditandai `true` hanya setelah struk retur benar-benar tercetak (M14).
    receipt_printed: false,
    receipt_printed_at: null,
    client_created_at: nowIso(),
    items,
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.returns.add(ret)

  // Struk retur — dua tanda tangan, keduanya wajib ([11 §M14.4]).
  await enqueueReturnReceipt(ret.id, {
    outletName: (await getBoundOutletLabel()) ?? 'POS Godinov',
    createdAt: ret.client_created_at,
    returnCode: ret.short_code ?? ret.id,
    originalCode: params.originalCode ?? ret.original_transaction_id,
    cashierName: params.cashierName ?? '-',
    authorizedByName: params.authorizedByName,
    reasonCode: ret.reason_code,
    reasonNotes: ret.reason_notes,
    refundMethodLabel: params.refundMethodLabel ?? ret.refund_method,
    refundAmount: ret.refund_amount,
    items: items.map((item) => ({
      name: item._product_name,
      qty: item.quantity,
      unitPrice: item.unit_price,
      restock: item.restock,
      wasteReasonCode: item.waste_reason_code,
    })),
  })

  notifyCommit('return')

  return ret
}

function isFullReturn(
  items: LocalReturnItem[],
  original: Readonly<Record<string, number>>,
): boolean {
  const ids = Object.keys(original)
  if (ids.length === 0) return false

  const returned = new Map<string, number>()
  for (const item of items) {
    returned.set(item.transaction_item_id, (returned.get(item.transaction_item_id) ?? 0) + item.quantity)
  }

  return ids.every((id) => (returned.get(id) ?? 0) >= original[id])
}

/**
 * Kuantitas yang **sudah** diretur per `transaction_item_id`.
 *
 * Sumber `alreadyReturned` untuk `decideCancellation`. Membaca dari retur lokal
 * saja bersifat optimistis: retur dari perangkat lain baru terlihat setelah
 * sinkronisasi. Server tetap menjadi penegak terakhir dengan
 * `SELECT … FOR UPDATE` ([11 §3.4]) — pemeriksaan di sini mencegah kasir
 * menghitung manual dan mencegah penolakan yang baru ketahuan setelah
 * pelanggan pulang.
 */
export async function returnedQuantities(
  transactionId: string,
): Promise<Record<string, number>> {
  const rows = await db.returns
    .where('original_transaction_id')
    .equals(transactionId)
    .toArray()

  const totals: Record<string, number> = {}
  for (const ret of rows) {
    // Retur berkarantina (`_synced = -1`) TIDAK dihitung: server menolaknya
    // secara permanen, sehingga barangnya tidak pernah benar-benar kembali.
    // Menghitungnya akan mengunci baris yang sebenarnya masih boleh diretur.
    if (ret._synced === -1) continue
    for (const item of ret.items) {
      totals[item.transaction_item_id] = (totals[item.transaction_item_id] ?? 0) + item.quantity
    }
  }
  return totals
}

export const listReturnsByShift = (shiftId: string): Promise<LocalReturn[]> =>
  db.returns.where('shift_id').equals(shiftId).reverse().sortBy('client_created_at')

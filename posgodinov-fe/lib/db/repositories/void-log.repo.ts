/**
 * Log pembatalan — butir 5, 6, 13, 15 ([11 §3.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA PERISTIWA PRA-TRANSAKSI IKUT DICATAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
 * membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar, selisih 6
 * masuk kantong. Tanpa baris ini peristiwa tersebut tidak meninggalkan jejak
 * apa pun — tidak ada transaksi, tidak ada stok bergerak, tidak ada yang bisa
 * diaudit.
 */

import { getBoundOutletLabel } from '@/lib/auth/device-session'
import { db } from '@/lib/db/dexie'
import type { LocalVoidLog, LocalVoidLogItem } from '@/lib/db/models'
import { enqueueCancelReceipt } from '@/lib/printer/print-queue'
import { notifyCommit } from '@/lib/sync/commit-notifier'
import { nowIso } from '@/lib/time'
import type { VoidScope } from '@/lib/types/api'
import { newUuid } from '@/lib/uuid'

export type RecordVoidParams = {
  scope: VoidScope
  shiftId: string
  staffId: string
  authorizedBy?: string | null

  /** Hanya `TRANSACTION`. */
  transactionId?: string | null
  /** Hanya `HELD_ORDER`. Lokal-only — server tidak mengenal pesanan tertahan. */
  heldCartId?: string | null
  /** Hanya `CART_LINE`. */
  productId?: string | null

  quantityBefore: number
  quantityAfter: number
  /** sen — nilai rupiah yang lenyap dari keranjang. */
  valueAmountMinor: number

  reasonCode: string
  reasonNotes?: string

  /**
   * Salinan item untuk `HELD_ORDER`/`TRANSACTION`.
   *
   * Pesanan tertahan **tidak pernah ada di server**; tanpa snapshot ini, isi
   * pesanan yang dibatalkan hilang selamanya dan audit hanya melihat sebuah
   * nominal tanpa penjelasan.
   */
  itemsSnapshot?: LocalVoidLogItem[] | null

  /* ── Konteks struk pembatalan (butir 6, [11 §M14.2]) ──────────────────── */

  /** Nama kasir pelaku, untuk dicetak. Berbeda dari `staffId` yang disimpan. */
  cashierName?: string
  /** Nama pemberi otoritas; kosong bila kebijakan tidak mewajibkannya. */
  authorizedByName?: string
  /** Kode struk asal — hanya `TRANSACTION`. */
  originalCode?: string
  /** Label pesanan tertahan — hanya `HELD_ORDER`. */
  heldCartLabel?: string
}

export async function recordVoidLog(params: RecordVoidParams): Promise<LocalVoidLog> {
  const log: LocalVoidLog = {
    id: newUuid(),
    shift_id: params.shiftId,
    staff_id: params.staffId,
    authorized_by: params.authorizedBy ?? null,
    scope: params.scope,
    transaction_id: params.transactionId ?? null,
    held_cart_id: params.heldCartId ?? null,
    product_id: params.productId ?? null,
    quantity_before: params.quantityBefore,
    quantity_after: params.quantityAfter,
    value_amount: params.valueAmountMinor,
    reason_code: params.reasonCode,
    reason_notes: params.reasonNotes ?? '',
    // Ditandai `true` hanya setelah `print_jobs` mencapai `PRINTED` (M14).
    // Menandainya di sini berarti mengaku sudah mencetak sebelum kertasnya ada.
    receipt_printed: false,
    receipt_printed_at: null,
    items_snapshot: params.itemsSnapshot ?? null,
    client_created_at: nowIso(),
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.voidLogs.add(log)

  // ── BUTIR 6 — struk pembatalan WAJIB terbit ([11 §M14.2]) ───────────────
  //
  // Diantre DI SINI, bukan di layar, supaya ketiga cakupan void melewatinya
  // tanpa kecuali. Layar yang lupa memanggilnya akan menghasilkan pembatalan
  // yang tidak meninggalkan kertas — dan kertas itulah satu-satunya hal yang
  // terlihat seketika oleh supervisor yang kebetulan lewat.
  //
  // ATURAN R6: `enqueueCancelReceipt` tidak pernah melempar. Baris `void_logs`
  // di atas sudah tersimpan, dan printer mati tidak boleh menghapusnya.
  await enqueueCancelReceipt(log.id, {
    outletName: (await getBoundOutletLabel()) ?? 'POS Godinov',
    createdAt: log.client_created_at,
    scope: log.scope,
    originalCode: params.originalCode,
    heldCartLabel: params.heldCartLabel,
    cashierName: params.cashierName ?? '-',
    authorizedByName: params.authorizedByName,
    reasonCode: log.reason_code,
    reasonNotes: log.reason_notes,
    items: (log.items_snapshot ?? []).map((item) => ({
      name: item.product_name,
      qty: item.quantity,
      unitPrice: item.unit_price,
    })),
    totalCancelled: log.value_amount,
  })

  // Pembatalan menempuh jendela debounce yang sama dengan penjualan, tetapi
  // dicatat sebagai pemicu `void` agar riwayat sync dapat menjawab pertanyaan
  // audit tanpa menebak ([11 §M12.2]).
  notifyCommit('void')

  return log
}

export const listVoidLogsByShift = (shiftId: string): Promise<LocalVoidLog[]> =>
  db.voidLogs.where('shift_id').equals(shiftId).reverse().sortBy('client_created_at')

/**
 * Nilai rupiah (**sen**) yang dibatalkan pada satu shift.
 *
 * Angka inilah yang dibaca laporan kecurangan pemilik: kasir dengan rasio void
 * tinggi terhadap penjualan adalah sinyal pertama yang dicari auditor.
 */
export async function voidedValueOfShift(shiftId: string): Promise<number> {
  const logs = await db.voidLogs.where('shift_id').equals(shiftId).toArray()
  return logs.reduce((sum, log) => sum + log.value_amount, 0)
}

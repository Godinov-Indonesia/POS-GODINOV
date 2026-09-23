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

import { getBoundOutletLabel } from '@/lib/auth/device-session'
import Dexie from 'dexie'

import { db } from '@/lib/db/dexie'
import type {
  LocalPayment,
  LocalTransaction,
  LocalTransactionItem,
  LocalWaste,
} from '@/lib/db/models'
import {
  paymentSummaryMethodSchema,
  type PaymentSummaryMethod,
} from '@/lib/constants/payment'
import { enqueueCancelReceipt, enqueueWasteReceipt } from '@/lib/printer/print-queue'
import { notifyCommit } from '@/lib/sync/commit-notifier'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

export async function saveTransaction(params: {
  shiftId: string
  customerName: string
  totalAmountMinor: number
  /**
   * Ringkasan v1-compat. `SPLIT` diterima sejak M17.2 (multi-tender, butir 8).
   */
  paymentMethod: PaymentSummaryMethod
  items: Omit<LocalTransactionItem, 'id' | 'transaction_id'>[]
  /**
   * Rincian tender — **sumber kebenaran pada v2** ([11 §3.2]).
   *
   * Kosong berarti transaksi lahir dari jalur lama; `resolvePayments()` akan
   * mensintesis satu baris dari `paymentMethod` saat sinkronisasi. Jalur
   * pembayaran M17.2 SELALU mengisinya.
   */
  payments?: LocalPayment[]
  cashReceivedMinor?: number
  changeMinor?: number
}): Promise<LocalTransaction> {
  // Penegakan runtime sebelum menulis ke Dexie ([05 §3.3 butir 2]) — menangkap
  // nilai rusak sebelum ia mencemari laporan secara permanen.
  paymentSummaryMethodSchema.parse(params.paymentMethod)

  // `SPLIT` tanpa rincian tidak dapat direkonstruksi siapa pun: ia menyatakan
  // ada dua tender atau lebih dan tidak menyisakan satu pun informasi tentang
  // pembagiannya. Ditolak DI SINI, bukan saat sinkronisasi — baris yang sudah
  // tertulis akan ditolak server berulang kali tanpa cara memperbaikinya dari
  // perangkat.
  if (params.paymentMethod === 'SPLIT' && (params.payments?.length ?? 0) < 2) {
    throw new Error('Ringkasan SPLIT memerlukan minimal dua baris tender.')
  }

  const id = newUuid()

  const transaction: LocalTransaction = {
    id,
    shift_id: params.shiftId,
    customer_name: params.customerName,
    total_amount: params.totalAmountMinor,
    payment_method: params.paymentMethod,
    ...(params.payments?.length ? { payments: params.payments } : {}),
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

  // AUTO-PUSH (butir 2) — diumumkan SETELAH penulisan berhasil. Mengumumkan
  // lebih awal berarti mesin sync dapat membaca antrean sebelum barisnya ada,
  // lalu menyimpulkan tidak ada yang perlu dikirim ([11 §M12.2]).
  notifyCommit('transaction')

  return transaction
}

/**
 * Void — dikirim sebagai transaksi ber-`id` sama berstatus `VOIDED`.
 *
 * Bila server sudah menyimpannya sebagai `COMPLETED`, server akan mengembalikan
 * bahan baku ke inventori (*reverse deduction*) lalu memperbarui status
 * ([03 §2.3]). Karena itu baris tidak dihapus, hanya ditandai dan diantrekan
 * ulang (`_synced = 0`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DUA PENULISAN, SATU TRANSAKSI ([11 §M13.2])
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Perubahan status dan `void_logs` ditulis dalam SATU transaksi Dexie. Bila
 * hanya statusnya yang tersimpan, transaksi lenyap dari penjualan tanpa satu
 * pun baris audit yang menjelaskan siapa membatalkannya dan mengapa — dan itu
 * persis bentuk yang butir 15 dibangun untuk mencegahnya.
 *
 * ⚠️ Pemanggil **wajib** memastikan `decideCancellation()` menghasilkan `VOID`
 * lebih dulu. Fungsi ini sengaja tidak memutuskannya sendiri: keputusan hidup
 * di satu tempat (`lib/pos/cancellation/decide.ts`), dan repositori yang ikut
 * memutuskan adalah duplikasi kedua yang akan menyimpang.
 */
export async function voidTransaction(params: {
  transactionId: string
  shiftId: string
  staffId: string
  reasonCode: string
  reasonNotes?: string
  authorizedBy?: string | null
  /** Nama kasir & pemberi otoritas — untuk dicetak (butir 6). */
  cashierName?: string
  authorizedByName?: string
}): Promise<void> {
  const now = nowIso()
  const voidLogId = newUuid()

  await db.transaction('rw', db.transactions, db.voidLogs, async () => {
    const transaction = await db.transactions.get(params.transactionId)
    if (!transaction) throw new Error('Transaksi tidak ditemukan.')

    await db.transactions.update(params.transactionId, {
      status: 'VOIDED',
      // `cancel_notes` v1 tetap diisi agar laporan lama tidak kosong selama
      // jendela deprekasi ([11 §M18.4]).
      cancel_notes: params.reasonNotes ?? '',
      void_reason_code: params.reasonCode,
      voided_at: now,
      voided_by: params.authorizedBy ?? params.staffId,
      _synced: 0,
      _syncError: null,
    })

    await db.voidLogs.add({
      id: voidLogId,
      shift_id: params.shiftId,
      staff_id: params.staffId,
      authorized_by: params.authorizedBy ?? null,
      scope: 'TRANSACTION',
      transaction_id: params.transactionId,
      held_cart_id: null,
      product_id: null,
      // Void transaksi membatalkan SELURUH isinya — tidak ada void sebagian.
      quantity_before: transaction.items.reduce((sum, item) => sum + item.quantity, 0),
      quantity_after: 0,
      value_amount: transaction.total_amount,
      reason_code: params.reasonCode,
      reason_notes: params.reasonNotes ?? '',
      receipt_printed: false,
      receipt_printed_at: null,
      // Snapshot disertakan walau transaksinya ada di server: laporan
      // kecurangan membaca `void_logs` sendirian, dan memaksanya menjoin ke
      // `transaction_items` untuk setiap baris membuat kueri audit mahal.
      items_snapshot: transaction.items.map((item) => ({
        product_id: item.product_id,
        product_name: item._product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      client_created_at: now,
      _synced: 0,
      _syncAttempts: 0,
      _syncError: null,
    })
  })

  // ── BUTIR 6 — struk pembatalan, DI LUAR transaksi Dexie ─────────────────
  //
  // Bukan sekadar urutan yang rapi: `print_jobs` tidak termasuk dalam cakupan
  // tabel transaksi di atas, dan menulisnya dari dalam akan dilempar Dexie.
  // Kebetulan itu juga urutan yang benar menurut R6 — barisnya harus sudah
  // ter-commit sebelum ada yang mencoba mencetak.
  const transaction = await db.transactions.get(params.transactionId)
  if (transaction) {
    await enqueueCancelReceipt(voidLogId, {
      outletName: (await getBoundOutletLabel()) ?? 'POS Godinov',
      createdAt: now,
      scope: 'TRANSACTION',
      originalCode: transaction.short_code ?? transaction.id,
      cashierName: params.cashierName ?? '-',
      authorizedByName: params.authorizedByName,
      reasonCode: params.reasonCode,
      reasonNotes: params.reasonNotes,
      items: transaction.items.map((item) => ({
        name: item._product_name,
        qty: item.quantity,
        unitPrice: item.unit_price,
      })),
      totalCancelled: transaction.total_amount,
    })
  }

  // Pembatalan menempuh jendela debounce yang sama dengan penjualan, tetapi
  // dicatat sebagai pemicu `void` agar riwayat sync dapat menjawab pertanyaan
  // audit tanpa menebak ([11 §M12.2]).
  notifyCommit('void')
}

export const getTransaction = (id: string): Promise<LocalTransaction | undefined> =>
  db.transactions.get(id)

/** Riwayat satu shift, terbaru dulu. Memakai indeks komposit `[shift_id+status]`. */
export async function listTransactionsByShift(shiftId: string): Promise<LocalTransaction[]> {
  const rows = await db.transactions.where('shift_id').equals(shiftId).toArray()
  return rows.sort((a, b) => b.client_created_at.localeCompare(a.client_created_at))
}

/**
 * Riwayat **shift aktif saja** — butir 16 ([11 §M17.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA BUKAN "HARI INI"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rentang "hari ini" memperlihatkan transaksi kasir SEBELUMNYA kepada kasir
 * yang sedang bertugas. Konsekuensinya bukan sekadar privasi: layar riwayat
 * adalah pintu masuk ke Void dan Retur, dan kasir yang dapat melihat transaksi
 * shift pagi dapat membatalkannya pada shift sore — dengan selisih kas jatuh ke
 * orang yang sudah pulang.
 *
 * Memakai indeks komposit `[shift_id+client_created_at]`: pengurutan terjadi di
 * IndexedDB, bukan di JavaScript setelah seluruh baris ditarik. Pada shift
 * sibuk dengan 400 transaksi, perbedaannya terasa pada setiap pembukaan layar.
 *
 * `reverse()` menghasilkan terbaru-dulu — yang dicari kasir hampir selalu
 * transaksi beberapa menit terakhir.
 */
export function listTransactionsOfShift(shiftId: string): Promise<LocalTransaction[]> {
  return db.transactions
    .where('[shift_id+client_created_at]')
    .between([shiftId, Dexie.minKey], [shiftId, Dexie.maxKey])
    .reverse()
    .toArray()
}

/**
 * Seluruh transaksi lokal, terbaru dulu — **hanya untuk `history_scope: 'ALL'`**
 * ([11 §M18.2]).
 *
 * ⚠️ Ini adalah perilaku v1 yang dipertahankan di balik *feature flag*, bukan
 * jalur normal. Bawaan v2 adalah [listTransactionsOfShift]: riwayat terikat
 * shift berjalan (butir 16), karena layar Riwayat adalah pintu masuk ke Void
 * dan Retur.
 *
 * Flag ini ada supaya satu bisnis yang belum siap dapat dikembalikan tanpa
 * *rollback* rilis — bukan supaya perilakunya dianggap setara.
 */
export function listAllTransactions(limit = 200): Promise<LocalTransaction[]> {
  return db.transactions
    .orderBy('client_created_at')
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Mencari satu transaksi lampau lewat kode struk atau UUID penuh.
 *
 * ⚠️ Mengembalikan **satu** transaksi atau `undefined` — tidak pernah daftar.
 * Pencarian yang mengembalikan daftar adalah penelusuran massal dengan nama
 * lain, dan itu persis yang butir 16 tutup.
 *
 * Dicari LOKAL dulu. Transaksi shift berjalan hampir pasti ada di perangkat,
 * dan menuntut jaringan untuk sesuatu yang sudah dipegang berarti fitur ini
 * mati di outlet tanpa sinyal.
 */
export async function findTransactionByCode(code: string): Promise<LocalTransaction | undefined> {
  const needle = code.trim()
  if (!needle) return undefined

  // UUID penuh → pencarian primary key langsung.
  const byId = await db.transactions.get(needle)
  if (byId) return byId

  // Kode struk. Diindeks, sehingga ini bukan pemindaian tabel.
  //
  // Dibandingkan HURUF BESAR: `short_code` diterbitkan server dalam huruf
  // besar, dan kasir mengetiknya dari kertas tanpa memperhatikan kapitalisasi.
  return db.transactions.where('short_code').equals(needle.toUpperCase()).first()
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

/**
 * Baris yang gagal tetapi MASIH akan dicoba ulang.
 *
 * `_syncAttempts > 0` membedakannya dari baris yang baru lahir dan belum pernah
 * dikirim sama sekali — keduanya bernilai `_synced = 0`, tetapi hanya yang
 * pertama layak ditampilkan sebagai "gagal".
 */
export const listFailedTransactions = (): Promise<LocalTransaction[]> =>
  db.transactions.filter((t) => t._synced === 0 && t._syncAttempts > 0).toArray()

/**
 * Baris berkarantina — ditolak server secara PERMANEN ([11 §4.3]).
 *
 * Berbeda dari daftar di atas, baris ini tidak akan pernah terkirim tanpa
 * seseorang menanganinya. Karena itu ia diberi kelompoknya sendiri di P-13.
 */
export const listQuarantinedTransactions = (): Promise<LocalTransaction[]> =>
  db.transactions.where('_synced').equals(-1).toArray()

export const countQuarantinedTransactions = (): Promise<number> =>
  db.transactions.where('_synced').equals(-1).count()

export const countQuarantinedWastes = (): Promise<number> =>
  db.wastes.where('_synced').equals(-1).count()

export const countQuarantinedReturns = (): Promise<number> =>
  db.returns.where('_synced').equals(-1).count()

export const countQuarantinedVoidLogs = (): Promise<number> =>
  db.voidLogs.where('_synced').equals(-1).count()

export const countQuarantinedSecurityEvents = (): Promise<number> =>
  db.securityEvents.where('_synced').equals(-1).count()

export const countUnsyncedReturns = (): Promise<number> =>
  db.returns.where('_synced').equals(0).count()

export const countUnsyncedVoidLogs = (): Promise<number> =>
  db.voidLogs.where('_synced').equals(0).count()

export const countUnsyncedSecurityEvents = (): Promise<number> =>
  db.securityEvents.where('_synced').equals(0).count()

/* ── Waste produk jadi (sisi kasir) ───────────────────────────────────────── */

export async function saveWaste(params: {
  staffId: string
  productId: string
  productName: string
  quantity: number
  reason: string
  /** Kamus beku [11 §3.5]; bawaannya `OTHER` untuk jalur lama. */
  reasonCode?: string
  shiftId?: string
  /** Nama petugas — untuk dicetak (butir 7). */
  staffName?: string
}): Promise<LocalWaste> {
  const waste: LocalWaste = {
    id: newUuid(),
    staff_id: params.staffId,
    product_id: params.productId,
    quantity: params.quantity,
    reason: params.reason,
    reason_code: params.reasonCode ?? 'OTHER',
    shift_id: params.shiftId,
    receipt_printed: false,
    printed_at: null,
    client_created_at: nowIso(),
    _product_name: params.productName,
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.wastes.add(waste)

  // ── BUTIR 7 — struk pembuangan WAJIB terbit ([11 §M14.3]) ───────────────
  //
  // Diantre di sini, bukan di layar, dengan alasan yang sama seperti struk
  // pembatalan: satu-satunya jalur penulisan waste adalah fungsi ini.
  await enqueueWasteReceipt(waste.id, {
    outletName: (await getBoundOutletLabel()) ?? 'POS Godinov',
    createdAt: waste.client_created_at,
    productName: params.productName,
    qty: params.quantity,
    reasonCode: waste.reason_code ?? 'OTHER',
    reasonNotes: params.reason,
    staffName: params.staffName ?? '-',
  })

  notifyCommit('waste')
  return waste
}

export const countUnsyncedWastes = (): Promise<number> =>
  db.wastes.where('_synced').equals(0).count()

/**
 * Basis data operasional POS — docs/05 §1.5.1.
 *
 * Versi skema bersifat **linear dan aditif**: v1 dipertahankan apa adanya agar
 * perangkat yang sudah terpasang bermigrasi, bukan kehilangan data. Jangan
 * mengubah blok `version(1)`; tambahkan `version(n+1)` baru.
 */

import Dexie, { type Table } from 'dexie'

import type {
  HeldCart,
  LocalCategory,
  LocalPayment,
  LocalProduct,
  LocalReturn,
  LocalSecurityEvent,
  LocalShift,
  LocalStaff,
  LocalTransaction,
  LocalVoidLog,
  LocalWaste,
  MetaRow,
  PrintJob,
  SyncLogRow,
} from '@/lib/db/models'
import { newUuid } from '@/lib/uuid'

export class POSDatabase extends Dexie {
  staffs!: Table<LocalStaff, string>
  categories!: Table<LocalCategory, string>
  products!: Table<LocalProduct, string>
  shifts!: Table<LocalShift, string>
  transactions!: Table<LocalTransaction, string>
  wastes!: Table<LocalWaste, string>
  heldCarts!: Table<HeldCart, string>
  meta!: Table<MetaRow, string>
  syncLog!: Table<SyncLogRow, number>

  /* ── v2 ([11 §3.6]) ────────────────────────────────────────────────────── */
  returns!: Table<LocalReturn, string>
  voidLogs!: Table<LocalVoidLog, string>
  securityEvents!: Table<LocalSecurityEvent, string>
  /** MURNI LOKAL — tidak pernah masuk antrean sync ([11 §3.8]). */
  printJobs!: Table<PrintJob, string>

  constructor() {
    super('posgodinov')

    // v1 — baseline sesuai [04 §A.6], dipertahankan agar migrasi tetap linear.
    this.version(1).stores({
      staffs: 'id, staff_identifier',
      categories: 'id, name',
      products: 'id, category_id, name',
      shifts: 'id, status, _synced',
      transactions: 'id, shift_id, status, _synced, client_created_at',
      wastes: 'id, _synced',
      heldCarts: 'id, created_at',
    })

    // v2 — indeks komposit untuk jalur panas sync + dua tabel infrastruktur.
    //
    // | Kueri                        | Indeks                      | Dipakai di                        |
    // |------------------------------|-----------------------------|-----------------------------------|
    // | Antrean sync urut waktu      | [_synced+client_created_at] | sync-engine — batching kronologis  |
    // | Penjualan tunai satu shift   | [shift_id+status]           | shift-math — expected_balance      |
    // | Shift terbuka saat ini       | [status+_synced]            | P-03/P-04 — deteksi shift OPEN     |
    this.version(2).stores({
      shifts: 'id, status, _synced, [status+_synced], staff_id',
      transactions:
        'id, shift_id, status, _synced, client_created_at, ' +
        '[_synced+client_created_at], [shift_id+status], [shift_id+_synced]',
      wastes: 'id, _synced, staff_id, [_synced+client_created_at]',
      meta: 'key',
      syncLog: '++id, at, ok',
    })

    // v3 — tambahkan indeks _syncedAt untuk pembersihan data master yang yatim (stale).
    this.version(3).stores({
      staffs: 'id, staff_identifier, _syncedAt',
      categories: 'id, name, _syncedAt',
      products: 'id, category_id, name, _syncedAt',
    })

    // ── v4 — Fase M11.4 ([11 §3.6]) ────────────────────────────────────────
    //
    // Empat tabel baru + indeks yang menopang tiga pertanyaan v2:
    //
    // | Kueri                              | Indeks                      | Butir |
    // |------------------------------------|-----------------------------|-------|
    // | Riwayat HANYA shift aktif          | [shift_id+client_created_at]| 16    |
    // | Cari transaksi lampau via kode     | short_code                  | 16    |
    // | Antrean sync entitas baru          | [_synced+client_created_at] | R9    |
    //
    // `short_code` TIDAK dideklarasikan `&unique`: tabrakan diselesaikan server
    // dengan `409` lalu klien membuat ulang suffix ([11 §3.2]). Indeks unik di
    // sisi klien akan membuat `add()` melempar di depan kasir yang sedang
    // melayani — kegagalan di tempat yang paling salah.
    this.version(4).stores({
      shifts: 'id, status, _synced, [status+_synced], staff_id, device_id',
      transactions:
        'id, shift_id, status, _synced, client_created_at, short_code, return_state, ' +
        '[_synced+client_created_at], [shift_id+status], [shift_id+_synced], ' +
        '[shift_id+client_created_at]',
      wastes: 'id, _synced, staff_id, shift_id, [_synced+client_created_at]',
      returns: 'id, original_transaction_id, shift_id, _synced, [_synced+client_created_at]',
      voidLogs: 'id, shift_id, scope, _synced, [_synced+client_created_at]',
      securityEvents: 'id, event_type, _synced, [_synced+client_created_at]',
      printJobs: 'id, status, kind, ref_id, created_at, [status+created_at]',
    }).upgrade(async (tx) => {
      const now = new Date().toISOString()

      await tx
        .table<LocalTransaction>('transactions')
        .toCollection()
        .modify((t) => {
          // ⚠️ KEPUTUSAN YANG TIDAK BOLEH DIBALIK TANPA DISKUSI.
          //
          // Struk v1 SELALU dicetak saat commit ([05 §1.7]), jadi setiap
          // transaksi lama memang sudah berpindah tangan sebagai kertas.
          // Membiarkan `receipt_printed_at` kosong akan membuka jalur VOID
          // untuk seluruh transaksi lampau — persis yang butir 15 larang, dan
          // persis lubang yang v2 dibangun untuk menutupnya.
          t.receipt_printed_at ??= t.client_created_at
          t.reprint_count ??= 0
          t.return_state ??= 'NONE'
          t.voided_at ??= null
          t.voided_by ??= null
          t.void_reason_code ??= null

          // Satu tender tunggal yang merekonstruksi keadaan v1: seluruh nominal
          // transaksi dibayar dengan satu metode. Invarian
          // `Σ payments.amount === total_amount` berlaku sejak baris pertama.
          //
          // `trace_number`/`card_last4` sengaja DIBIARKAN KOSONG untuk baris
          // DEBIT lama — mengarangnya berarti memalsukan bukti audit. Baris
          // tersebut ditolak `ck_card_requires_trace` bila dikirim ulang pada
          // kontrak v2, lalu masuk karantina dengan alasan yang jujur.
          if (!t.payments?.length && t.payment_method !== 'SPLIT') {
            const single: LocalPayment = {
              id: newUuid(),
              sequence: 1,
              method: t.payment_method,
              amount: t.total_amount,
            }
            t.payments = [single]
          }
        })

      await tx
        .table<LocalWaste>('wastes')
        .toCollection()
        .modify((w) => {
          w.reason_code ??= 'OTHER'
          w.receipt_printed ??= false
          w.printed_at ??= null
        })

      await tx
        .table<LocalShift>('shifts')
        .toCollection()
        .modify((sh) => {
          // Kasir v1 menghitung dan MELIHAT angka ini; nilainya tetap dipakai
          // sebagai deklarasi historis agar shift lama tidak menjadi kosong di
          // laporan. `blind_close: false` menyatakan apa adanya bahwa shift ini
          // BUKAN kesaksian buta — pembedaan yang menentukan nilai auditnya.
          sh.declared_cash ??= sh.closing_balance
          sh.declared_edc_total ??= 0
          sh.declared_qris_total ??= 0
          sh.blind_close ??= false
          sh.closed_by ??= null
          // `master_data_version` sengaja DIBIARKAN ABSEN: shift v1 lahir
          // sebelum butir 10 ada, dan mengisinya dengan angka mana pun berarti
          // mengklaim gerbang master data sudah dilewati padahal tidak.
        })

      await tx.table<MetaRow>('meta').put({
        key: 'schema.v4MigratedAt',
        value: now,
        updated_at: now,
      })
    })
  }
}

export const db = new POSDatabase()

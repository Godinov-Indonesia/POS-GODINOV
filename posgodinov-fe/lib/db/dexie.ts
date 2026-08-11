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
  LocalProduct,
  LocalShift,
  LocalStaff,
  LocalTransaction,
  LocalWaste,
  MetaRow,
  SyncLogRow,
} from '@/lib/db/models'

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
  }
}

export const db = new POSDatabase()

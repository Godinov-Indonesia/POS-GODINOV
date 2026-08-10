/**
 * Mesin sinkronisasi — docs/05 §1.6.2.
 *
 * ADR-06: **tidak** memakai `BackgroundSyncPlugin` Workbox. Plugin itu memutar
 * ulang request yang gagal lalu **membuang responsnya**, padahal seluruh nilai
 * `POST /v1/pos/sync` justru ada di response — `failed_transactions` yang
 * menentukan baris mana yang boleh ditandai tersinkron. Karena itu antreannya
 * dikelola sendiri: **Dexie adalah antreannya** (`_synced = 0`), dan mesin ini
 * berjalan di konteks halaman.
 */

import Dexie from 'dexie'

import { syncUp as postSyncUp } from '@/lib/api/endpoints/pos-sync'
import { MAX_TRANSACTIONS_PER_BATCH } from '@/lib/constants/limits'
import { db } from '@/lib/db/dexie'
import type { LocalShift, SyncTrigger } from '@/lib/db/models'
import { setMeta } from '@/lib/db/repositories/meta.repo'
import { clearBackoff, getBackoffUntil, recordFailure } from '@/lib/sync/backoff'
import { reconcile, type SyncOutcome } from '@/lib/sync/reconcile'
import { toWireShift, toWireTransaction, toWireWaste } from '@/lib/sync/wire'
import { nowIso } from '@/lib/time'

export type SyncResult =
  | ({ kind: 'done' } & SyncOutcome)
  | { kind: 'skipped'; reason: 'locked' | 'backoff' | 'offline' | 'empty' }

const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
  const seen = new Map<string, T>()
  for (const row of rows) seen.set(row.id, row)
  return [...seen.values()]
}

export async function syncUp(
  trigger: SyncTrigger,
  options: { ignoreBackoff?: boolean } = {},
): Promise<SyncResult> {
  // Web Locks API: mutex LINTAS TAB. Mutex berbasis variabel modul tidak cukup —
  // dua tab POS terbuka akan mengirim payload yang sama dua kali.
  const run = async (): Promise<SyncResult> => {
    if (!options.ignoreBackoff && Date.now() < (await getBackoffUntil())) {
      return { kind: 'skipped', reason: 'backoff' }
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { kind: 'skipped', reason: 'offline' }
    }

    // ── 1. Ambil antrean, kronologis ──────────────────────────────────────
    const transactions = await db.transactions
      .where('[_synced+client_created_at]')
      .between([0, Dexie.minKey], [0, Dexie.maxKey])
      .limit(MAX_TRANSACTIONS_PER_BATCH)
      .toArray()

    const wastes = await db.wastes.where('_synced').equals(0).toArray()

    // ── 2. ATURAN KRITIS ──────────────────────────────────────────────────
    // Sertakan shift induk dari SETIAP transaksi dalam batch, walau shift itu
    // sudah pernah ditandai tersinkron.
    //
    // `transactions.shift_id` punya FK ke `shifts(id)` dan backend memproses
    // Shifts → Transactions → Wastes. Kegagalan shift TIDAK dilaporkan per-ID,
    // sehingga sebuah shift bisa saja tidak pernah benar-benar tersimpan meski
    // kita menandainya tersinkron. Menyertakannya ulang bersifat aman: upsert
    // backend idempotent (ON CONFLICT DO UPDATE pada kolom penutupan saja).
    const unsyncedShifts = await db.shifts.where('_synced').equals(0).toArray()
    const parentShiftIds = [...new Set(transactions.map((t) => t.shift_id))]
    const parentShifts = await db.shifts.bulkGet(parentShiftIds)

    const shifts = dedupeById([
      ...unsyncedShifts,
      ...parentShifts.filter((s): s is LocalShift => !!s),
    ])

    if (!shifts.length && !transactions.length && !wastes.length) {
      return { kind: 'skipped', reason: 'empty' }
    }

    // ── 3. Kirim ──────────────────────────────────────────────────────────
    let response
    try {
      response = await postSyncUp({
        shifts: shifts.map(toWireShift),
        transactions: transactions.map(toWireTransaction),
        // ⚠️ kunci `wastes`, BUKAN `product_wastes` — nama yang salah membuat
        // data waste diabaikan server tanpa error apa pun ([03 §2.3]).
        wastes: wastes.map(toWireWaste),
      })
    } catch (error) {
      await recordFailure()
      throw error
    }

    // ── 4. Rekonsiliasi ───────────────────────────────────────────────────
    const outcome = await reconcile({ sent: { shifts, transactions, wastes }, response })

    if (outcome.ok) {
      await clearBackoff()
      await setMeta('sync.lastSuccessAt', nowIso())
    } else {
      // Sebagian gagal → tetap mundur sebelum mencoba lagi, supaya kegagalan
      // deterministik tidak berubah menjadi lingkaran request tanpa jeda.
      await recordFailure()
    }

    void trigger
    return { kind: 'done', ...outcome }
  }

  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    // Peramban tanpa Web Locks: jalankan tanpa mutex lintas tab. Risikonya
    // pengiriman ganda, yang tetap aman karena backend idempotent — hanya
    // boros, bukan merusak.
    return run()
  }

  const result = await navigator.locks.request(
    'posgodinov.sync',
    { ifAvailable: true },
    async (lock) => (lock ? run() : ({ kind: 'skipped', reason: 'locked' } as const)),
  )

  return result
}

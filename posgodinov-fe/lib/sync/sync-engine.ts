/**
 * Mesin sinkronisasi — docs/05 §1.6.2, dinaikkan ke kontrak v2 pada Fase M12
 * ([11 §M12.2, §4.2]).
 *
 * ADR-06: **tidak** memakai `BackgroundSyncPlugin` Workbox. Plugin itu memutar
 * ulang request yang gagal lalu **membuang responsnya**, padahal seluruh nilai
 * `POST /v1/pos/sync` justru ada di response — `errors[]` yang menentukan baris
 * mana yang boleh ditandai tersinkron dan baris mana yang harus dikarantina.
 * Karena itu antreannya dikelola sendiri: **Dexie adalah antreannya**
 * (`_synced = 0`), dan mesin ini berjalan di konteks halaman.
 */

import Dexie from 'dexie'

import { syncUpV2 as postSyncUp } from '@/lib/api/endpoints/pos-sync'
import { MAX_TRANSACTIONS_PER_BATCH } from '@/lib/constants/limits'
import { db } from '@/lib/db/dexie'
import type { LocalShift, SyncLogRow, SyncTrigger } from '@/lib/db/models'
import { getMeta, setMeta } from '@/lib/db/repositories/meta.repo'
import { clearBackoff, getBackoffUntil, recordFailure } from '@/lib/sync/backoff'
import {
  getConnectivitySnapshot,
  reportNetworkFailure,
  reportNetworkSuccess,
  shouldAttemptNetwork,
} from '@/lib/sync/connectivity-store'
import { reconcile, type SentBatch, type SyncOutcome } from '@/lib/sync/reconcile'
import {
  toWireReturn,
  toWireSecurityEvent,
  toWireShiftV2,
  toWireTransactionV2,
  toWireVoidLog,
  toWireWasteV2,
} from '@/lib/sync/wire'
import { nowIso } from '@/lib/time'

export type SyncResult =
  | ({ kind: 'done' } & SyncOutcome)
  | { kind: 'skipped'; reason: 'locked' | 'backoff' | 'offline' | 'empty' }

const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
  const seen = new Map<string, T>()
  for (const row of rows) seen.set(row.id, row)
  return [...seen.values()]
}

/**
 * Pemicu yang **berhak menembus backoff** sekali.
 *
 * Kasir baru saja menyelesaikan transaksi dan menatap indikator antrean.
 * Menahannya di balik jeda 5 menit karena satu kegagalan yang sudah lewat
 * membuat sistem terasa rusak padahal jaringannya mungkin sudah pulih detik
 * itu. Percobaan ini murah: bila memang masih gagal, backoff berikutnya justru
 * bertambah dan tidak ada yang terulang lebih cepat.
 */
const BACKOFF_PIERCING_TRIGGERS: ReadonlySet<SyncTrigger> = new Set<SyncTrigger>([
  'transaction-commit',
  'void',
  'return',
  'shift-close',
])

/** Batas atas peristiwa keamanan per batch — barisnya kecil, tetapi tidak tak hingga. */
const MAX_SECURITY_EVENTS_PER_BATCH = 500

export async function syncUp(
  trigger: SyncTrigger,
  options: { ignoreBackoff?: boolean } = {},
): Promise<SyncResult> {
  // Web Locks API: mutex LINTAS TAB. Mutex berbasis variabel modul tidak cukup —
  // dua tab POS terbuka akan mengirim payload yang sama dua kali.
  const run = async (): Promise<SyncResult> => {
    const startedAt = Date.now()

    const piercesBackoff = options.ignoreBackoff || BACKOFF_PIERCING_TRIGGERS.has(trigger)
    if (!piercesBackoff && Date.now() < (await getBackoffUntil())) {
      return { kind: 'skipped', reason: 'backoff' }
    }

    // Gerbang jaringan memakai store konektivitas, BUKAN `navigator.onLine`
    // langsung ([11 §M12.1]). Status `degraded` sengaja tetap boleh mencoba:
    // itulah satu-satunya cara mengetahui captive portal sudah dilewati.
    if (!shouldAttemptNetwork(getConnectivitySnapshot().status)) {
      return { kind: 'skipped', reason: 'offline' }
    }

    // ── 1. Ambil antrean, kronologis ──────────────────────────────────────
    const transactions = await db.transactions
      .where('[_synced+client_created_at]')
      .between([0, Dexie.minKey], [0, Dexie.maxKey])
      .limit(MAX_TRANSACTIONS_PER_BATCH)
      .toArray()

    const wastes = await db.wastes.where('_synced').equals(0).toArray()

    // Entitas v2. Tabelnya baru ada sejak Dexie v4; perangkat yang belum
    // bermigrasi tidak akan pernah sampai ke sini karena Dexie membuka
    // database pada versi tertinggi yang dideklarasikan.
    const returns = await db.returns
      .where('[_synced+client_created_at]')
      .between([0, Dexie.minKey], [0, Dexie.maxKey])
      .limit(MAX_TRANSACTIONS_PER_BATCH)
      .toArray()

    const voidLogs = await db.voidLogs
      .where('[_synced+client_created_at]')
      .between([0, Dexie.minKey], [0, Dexie.maxKey])
      .limit(MAX_TRANSACTIONS_PER_BATCH)
      .toArray()

    const securityEvents = await db.securityEvents
      .where('[_synced+client_created_at]')
      .between([0, Dexie.minKey], [0, Dexie.maxKey])
      .limit(MAX_SECURITY_EVENTS_PER_BATCH)
      .toArray()

    // ── 2. ATURAN KRITIS ──────────────────────────────────────────────────
    // Sertakan shift induk dari SETIAP transaksi dalam batch, walau shift itu
    // sudah pernah ditandai tersinkron.
    //
    // `transactions.shift_id` punya FK ke `shifts(id)` dan backend memproses
    // Shifts → Transactions → Returns → VoidLogs → Wastes → SecurityEvents.
    // Kegagalan shift TIDAK dilaporkan per-ID pada kontrak v1, sehingga sebuah
    // shift bisa saja tidak pernah benar-benar tersimpan meski kita
    // menandainya tersinkron. Menyertakannya ulang bersifat aman: upsert
    // backend idempotent (ON CONFLICT DO UPDATE pada kolom penutupan saja).
    const unsyncedShifts = await db.shifts.where('_synced').equals(0).toArray()
    const parentShiftIds = [
      ...new Set([
        ...transactions.map((t) => t.shift_id),
        ...returns.map((r) => r.shift_id),
        ...voidLogs.map((v) => v.shift_id),
      ]),
    ]
    const parentShifts = await db.shifts.bulkGet(parentShiftIds)

    const shifts = dedupeById([
      ...unsyncedShifts,
      ...parentShifts.filter((s): s is LocalShift => !!s),
    ])

    const sent: SentBatch = { shifts, transactions, wastes, returns, voidLogs, securityEvents }

    if (isEmptyBatch(sent)) {
      return { kind: 'skipped', reason: 'empty' }
    }

    // ── 3. Kirim ──────────────────────────────────────────────────────────
    const deviceId = (await getMeta<string>('device.id')) ?? 'legacy'
    const masterDataVersion = (await getMeta<number>('master.version')) ?? null

    let response
    try {
      response = await postSyncUp({
        device_id: deviceId,
        master_data_version: masterDataVersion,
        shifts: shifts.map((s) => toWireShiftV2(s, deviceId)),
        transactions: transactions.map((t) => toWireTransactionV2(t, deviceId)),
        returns: returns.map((r) => toWireReturn(r, deviceId)),
        void_logs: voidLogs.map((v) => toWireVoidLog(v, deviceId)),
        // ⚠️ kunci `wastes`, BUKAN `product_wastes` — nama yang salah membuat
        // data waste diabaikan server tanpa error apa pun ([03 §2.3]).
        wastes: wastes.map((w) => toWireWasteV2(w, deviceId)),
        security_events: securityEvents.map((e) => toWireSecurityEvent(e, deviceId)),
      })
    } catch (error) {
      // Kegagalan TRANSPORT — server tidak menjawab sama sekali. Inilah satu-
      // satunya bukti sah bahwa jaringan bermasalah; response `4xx`/`5xx` yang
      // benar-benar tiba justru membuktikan jaringan hidup.
      reportNetworkFailure()
      await recordFailure()
      await writeSyncLog(trigger, sent, null, startedAt, error)
      throw error
    }

    reportNetworkSuccess(nowIso())

    // ── 4. Rekonsiliasi ───────────────────────────────────────────────────
    const outcome = await reconcile({ sent, response })

    if (outcome.ok) {
      await clearBackoff()
      await setMeta('sync.lastSuccessAt', nowIso())
    } else {
      // Sebagian gagal → tetap mundur sebelum mencoba lagi, supaya kegagalan
      // deterministik tidak berubah menjadi lingkaran request tanpa jeda.
      await recordFailure()
    }

    // Server memberi tahu versi master data terkininya pada setiap putaran;
    // menyimpannya di sini membuat gerbang Buka Shift (butir 10) tidak perlu
    // permintaan terpisah hanya untuk membandingkan dua angka.
    if (typeof response.master_data_version === 'number') {
      await setMeta('master.serverVersion', response.master_data_version)
    }

    await writeSyncLog(trigger, sent, outcome, startedAt, null)

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

const isEmptyBatch = (batch: SentBatch): boolean =>
  batch.shifts.length === 0 &&
  batch.transactions.length === 0 &&
  batch.wastes.length === 0 &&
  batch.returns.length === 0 &&
  batch.voidLogs.length === 0 &&
  batch.securityEvents.length === 0

/**
 * Menulis satu baris riwayat putaran ([11 §M12.3]).
 *
 * Dipanggil baik pada keberhasilan maupun kegagalan transport — justru putaran
 * yang GAGAL yang paling dicari saat menelusuri insiden, dan itulah yang tidak
 * pernah muncul di log server karena permintaannya tidak pernah sampai.
 *
 * Kegagalan penulisan log ditelan: riwayat adalah alat bantu diagnosis, bukan
 * data keuangan. Menggagalkan putaran sinkronisasi karena log tidak tertulis
 * akan menukar sesuatu yang penting dengan sesuatu yang tidak.
 */
async function writeSyncLog(
  trigger: SyncTrigger,
  sent: SentBatch,
  outcome: SyncOutcome | null,
  startedAt: number,
  error: unknown,
): Promise<void> {
  const row: SyncLogRow = {
    at: nowIso(),
    trigger,
    ok: outcome?.ok ?? false,
    shifts_sent: sent.shifts.length,
    shifts_synced: outcome?.shiftsSynced ?? 0,
    transactions_sent: sent.transactions.length,
    transactions_synced: outcome?.transactionsSynced ?? 0,
    wastes_sent: sent.wastes.length,
    wastes_synced: outcome?.wastesSynced ?? 0,
    returns_sent: sent.returns.length,
    returns_synced: outcome?.returnsSynced ?? 0,
    void_logs_sent: sent.voidLogs.length,
    void_logs_synced: outcome?.voidLogsSynced ?? 0,
    security_events_sent: sent.securityEvents.length,
    security_events_synced: outcome?.securityEventsSynced ?? 0,
    quarantined: outcome?.quarantined ?? 0,
    failed_transaction_ids: outcome?.failedTransactionIds ?? [],
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    duration_ms: Date.now() - startedAt,
  }

  try {
    await db.syncLog.add(row)
    await pruneSyncLog()
  } catch {
    // sengaja diabaikan — lihat catatan di atas
  }
}

/**
 * Batas riwayat yang disimpan.
 *
 * Putaran berjalan tiap 5 menit ditambah satu per transaksi; tanpa pemangkasan,
 * tabel ini tumbuh tanpa batas sepanjang umur perangkat. 200 baris cukup untuk
 * menelusuri satu shift penuh ke belakang.
 */
const SYNC_LOG_LIMIT = 200

async function pruneSyncLog(): Promise<void> {
  const count = await db.syncLog.count()
  if (count <= SYNC_LOG_LIMIT) return

  const excess = count - SYNC_LOG_LIMIT
  const oldest = await db.syncLog.orderBy('id').limit(excess).primaryKeys()
  await db.syncLog.bulkDelete(oldest)
}

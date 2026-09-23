/**
 * Rekonsiliasi partial success — docs/05 §1.6.3, diperluas pada Fase M12.3
 * ([11 §4.3]).
 *
 * Inilah kontrak terpenting endpoint sync: **`200` tidak berarti semuanya
 * berhasil** ([03 §2.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA NASIB SEBUAH BARIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * | `_synced` | Arti                | Kapan                                    |
 * |-----------|---------------------|------------------------------------------|
 * | `1`       | Tersinkron          | Server menerimanya                       |
 * | `0`       | Mengantre           | Gagal, tetapi layak dicoba lagi          |
 * | `-1`      | **Karantina**       | Server menolak dengan `retryable: false` |
 *
 * Karantina adalah tambahan v2 dan alasannya operasional, bukan estetis. Baris
 * yang cacat PERMANEN — transaksi kartu tanpa trace number, retur yang melebihi
 * kuantitas asal — tidak akan pernah diterima berapa kali pun dikirim ulang.
 * Membiarkannya di antrean berarti setiap putaran sinkronisasi membawa ulang
 * baris yang pasti ditolak, dan seluruh baris di belakangnya ikut tertahan.
 * Baris berkarantina keluar dari antrean dan muncul di P-13 sebagai "Butuh
 * tindakan" — satu-satunya kategori yang benar-benar menuntut manusia.
 */

import { db } from '@/lib/db/dexie'
import type {
  LocalReturn,
  LocalSecurityEvent,
  LocalShift,
  LocalTransaction,
  LocalVoidLog,
  LocalWaste,
} from '@/lib/db/models'
import { nowIso } from '@/lib/time'
import type { SyncError, SyncUpResponseV2 } from '@/lib/types/api'

export type SentBatch = {
  shifts: LocalShift[]
  transactions: LocalTransaction[]
  wastes: LocalWaste[]
  returns: LocalReturn[]
  voidLogs: LocalVoidLog[]
  securityEvents: LocalSecurityEvent[]
}

export type ReconcileInput = {
  sent: SentBatch
  response: SyncUpResponseV2
}

export type SyncOutcome = {
  ok: boolean
  failedTransactionIds: string[]
  shiftsSynced: number
  transactionsSynced: number
  wastesSynced: number
  returnsSynced: number
  voidLogsSynced: number
  securityEventsSynced: number
  /** Jumlah baris yang dipindahkan ke karantina pada putaran ini. */
  quarantined: number
}

/** Indeks galat per-entitas agar pencariannya `O(1)`, bukan `O(n²)`. */
type ErrorIndex = Map<string, SyncError>

const indexErrors = (errors: SyncError[] | null | undefined): ErrorIndex => {
  const index: ErrorIndex = new Map()
  for (const error of errors ?? []) index.set(`${error.entity}:${error.id}`, error)
  return index
}

export async function reconcile({ sent, response }: ReconcileInput): Promise<SyncOutcome> {
  const failedIds = new Set(response.failed_transactions ?? []) // bisa null → normalisasi
  const errors = indexErrors(response.errors)
  const now = nowIso()
  let quarantined = 0

  /**
   * Menentukan nasib satu baris.
   *
   * Galat per-entitas (v2) selalu menang atas hitungan agregat (v1): ia lebih
   * spesifik dan membawa alasan yang dapat dibaca kasir.
   */
  const verdict = (
    entity: SyncError['entity'],
    id: string,
    fallbackFailed: boolean,
    fallbackMessage: string,
  ): { synced: -1 | 0 | 1; message: string | null } => {
    const error = errors.get(`${entity}:${id}`)

    if (error) {
      if (!error.retryable) {
        quarantined += 1
        return { synced: -1, message: `${error.code}: ${error.message}` }
      }
      return { synced: 0, message: `${error.code}: ${error.message}` }
    }

    if (fallbackFailed) return { synced: 0, message: fallbackMessage }
    return { synced: 1, message: null }
  }

  // Backend melaporkan kegagalan shift dan waste HANYA lewat selisih hitungan
  // pada kontrak v1. Bila jumlahnya tidak cocok dan tidak ada galat per-entitas,
  // kita tidak tahu baris MANA yang gagal — maka tidak satu pun boleh ditandai
  // tersinkron.
  const allShiftsOk = response.shifts_synced === sent.shifts.length
  const allWastesOk = response.wastes_synced === sent.wastes.length

  // Bentuk ARRAY, bukan variadic: overload variadic Dexie berhenti di lima
  // tabel, dan putaran v2 menyentuh enam. Seluruhnya harus berada dalam SATU
  // transaksi — rekonsiliasi yang setengah tertulis meninggalkan sebagian baris
  // mengaku tersinkron padahal batch-nya gagal.
  await db.transaction(
    'rw',
    [db.shifts, db.transactions, db.wastes, db.returns, db.voidLogs, db.securityEvents],
    async () => {
      for (const shift of sent.shifts) {
        const v = verdict(
          'shift',
          shift.id,
          !allShiftsOk,
          `Sebagian shift gagal tersimpan (${response.shifts_synced}/${sent.shifts.length}). ` +
            'Transaksi pada shift ini akan ikut tertunda.',
        )
        await db.shifts.update(shift.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : shift._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? shift._lastSyncAttemptAt : now,
        })
      }

      for (const transaction of sent.transactions) {
        const v = verdict(
          'transaction',
          transaction.id,
          failedIds.has(transaction.id),
          'Ditolak server saat sinkronisasi. Akan dicoba ulang.',
        )
        await db.transactions.update(transaction.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : transaction._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? transaction._lastSyncAttemptAt : now,
        })
      }

      for (const waste of sent.wastes) {
        const v = verdict(
          'waste',
          waste.id,
          !allWastesOk,
          `Sebagian waste gagal (${response.wastes_synced}/${sent.wastes.length}).`,
        )
        await db.wastes.update(waste.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : waste._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? waste._lastSyncAttemptAt : now,
        })
      }

      // Entitas v2 dilacak SEPENUHNYA per-ID. Tidak ada mode agregat, sehingga
      // tidak ada tebakan: baris tanpa galat berarti diterima.
      const allReturnsOk = response.returns_synced === sent.returns.length
      for (const ret of sent.returns) {
        const v = verdict('return', ret.id, !allReturnsOk, 'Retur belum tersimpan di server.')
        await db.returns.update(ret.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : ret._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? ret._lastSyncAttemptAt : now,
        })
      }

      const allVoidsOk = response.void_logs_synced === sent.voidLogs.length
      for (const log of sent.voidLogs) {
        const v = verdict('void_log', log.id, !allVoidsOk, 'Log pembatalan belum tersimpan di server.')
        await db.voidLogs.update(log.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : log._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? log._lastSyncAttemptAt : now,
        })
      }

      const allEventsOk = response.security_events_synced === sent.securityEvents.length
      for (const event of sent.securityEvents) {
        const v = verdict(
          'security_event',
          event.id,
          !allEventsOk,
          'Peristiwa keamanan belum tersimpan di server.',
        )
        await db.securityEvents.update(event.id, {
          _synced: v.synced,
          _syncError: v.message,
          _syncAttempts: v.synced === 1 ? 0 : event._syncAttempts + 1,
          _lastSyncAttemptAt: v.synced === 1 ? event._lastSyncAttemptAt : now,
        })
      }
    },
  )

  return {
    // Karantina TIDAK membuat putaran dinyatakan gagal. Barisnya memang tidak
    // akan pernah terkirim, dan menandai `ok: false` selamanya akan membuat
    // backoff terus membesar untuk antrean yang sebenarnya sehat.
    ok:
      allShiftsOk &&
      allWastesOk &&
      failedIds.size === 0 &&
      (response.errors ?? []).every((e) => !e.retryable),
    failedTransactionIds: [...failedIds],
    shiftsSynced: response.shifts_synced,
    transactionsSynced: response.transactions_synced,
    wastesSynced: response.wastes_synced,
    returnsSynced: response.returns_synced ?? 0,
    voidLogsSynced: response.void_logs_synced ?? 0,
    securityEventsSynced: response.security_events_synced ?? 0,
    quarantined,
  }
}

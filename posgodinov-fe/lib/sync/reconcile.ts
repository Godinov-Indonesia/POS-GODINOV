/**
 * Rekonsiliasi partial success — docs/05 §1.6.3.
 *
 * Inilah kontrak terpenting endpoint sync: **`200` tidak berarti semuanya
 * berhasil** ([03 §2.3]). Backend hanya melacak kegagalan **transaksi**
 * per-ID; kegagalan shift dan waste dilaporkan semata lewat selisih hitungan.
 */

import { db } from '@/lib/db/dexie'
import type { LocalShift, LocalTransaction, LocalWaste } from '@/lib/db/models'
import { nowIso } from '@/lib/time'
import type { SyncUpResponse } from '@/lib/types/api'

export type ReconcileInput = {
  sent: { shifts: LocalShift[]; transactions: LocalTransaction[]; wastes: LocalWaste[] }
  response: SyncUpResponse
}

export type SyncOutcome = {
  ok: boolean
  failedTransactionIds: string[]
  shiftsSynced: number
  transactionsSynced: number
  wastesSynced: number
}

export async function reconcile({ sent, response }: ReconcileInput): Promise<SyncOutcome> {
  const failedIds = new Set(response.failed_transactions ?? []) // bisa null → normalisasi
  const now = nowIso()

  // Backend melaporkan kegagalan shift HANYA lewat selisih hitungan
  // (`failed_shifts` tidak ada). Bila jumlahnya tidak cocok, kita tidak tahu
  // shift MANA yang gagal — maka tidak satu pun boleh ditandai tersinkron.
  const allShiftsOk = response.shifts_synced === sent.shifts.length
  const allWastesOk = response.wastes_synced === sent.wastes.length

  await db.transaction('rw', db.shifts, db.transactions, db.wastes, async () => {
    for (const shift of sent.shifts) {
      if (allShiftsOk) {
        await db.shifts.update(shift.id, { _synced: 1, _syncError: null, _syncAttempts: 0 })
      } else {
        await db.shifts.update(shift.id, {
          _synced: 0,
          _syncAttempts: shift._syncAttempts + 1,
          _lastSyncAttemptAt: now,
          _syncError:
            `Sebagian shift gagal tersimpan (${response.shifts_synced}/${sent.shifts.length}). ` +
            'Transaksi pada shift ini akan ikut tertunda.',
        })
      }
    }

    // Transaksi — satu-satunya entitas yang dilacak per-ID.
    for (const transaction of sent.transactions) {
      if (failedIds.has(transaction.id)) {
        await db.transactions.update(transaction.id, {
          _synced: 0,
          _syncAttempts: transaction._syncAttempts + 1,
          _lastSyncAttemptAt: now,
          _syncError: 'Ditolak server saat sinkronisasi. Akan dicoba ulang.',
        })
      } else {
        await db.transactions.update(transaction.id, {
          _synced: 1,
          _syncError: null,
          _syncAttempts: 0,
        })
      }
    }

    for (const waste of sent.wastes) {
      await db.wastes.update(
        waste.id,
        allWastesOk
          ? { _synced: 1, _syncError: null, _syncAttempts: 0 }
          : {
              _synced: 0,
              _syncAttempts: waste._syncAttempts + 1,
              _lastSyncAttemptAt: now,
              _syncError: `Sebagian waste gagal (${response.wastes_synced}/${sent.wastes.length}).`,
            },
      )
    }
  })

  return {
    ok: allShiftsOk && allWastesOk && failedIds.size === 0,
    failedTransactionIds: [...failedIds],
    shiftsSynced: response.shifts_synced,
    transactionsSynced: response.transactions_synced,
    wastesSynced: response.wastes_synced,
  }
}

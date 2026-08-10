'use client'

import * as React from 'react'

import { useSyncStore } from '@/features/pos/sync/sync-store'
import type { SyncTrigger } from '@/lib/db/models'
import { resetFailureCounter } from '@/lib/sync/backoff'
import { syncUp } from '@/lib/sync/sync-engine'
import { installSyncTriggers } from '@/lib/sync/sync-triggers'
import { nowIso } from '@/lib/time'

/** Menjalankan sync dan memantulkan hasilnya ke store tampilan. */
export async function runSync(
  trigger: SyncTrigger,
  options: { ignoreBackoff?: boolean } = {},
): Promise<void> {
  const store = useSyncStore.getState()
  store.setSyncing(true, trigger)

  try {
    const result = await syncUp(trigger, options)

    if (result.kind === 'skipped') {
      store.setSkipped(result.reason)
      return
    }

    store.setSkipped(null)
    if (result.ok) {
      store.setSuccess(nowIso())
    } else {
      store.setError(
        result.failedTransactionIds.length
          ? `${result.failedTransactionIds.length} transaksi ditolak server.`
          : 'Sebagian data belum tersimpan di server.',
      )
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Sinkronisasi gagal')
  } finally {
    useSyncStore.getState().setSyncing(false)
  }
}

/** Tombol manual P-13 — selalu tersedia dan mengabaikan backoff. */
export const runManualSync = (): Promise<void> => {
  resetFailureCounter()
  return runSync('manual', { ignoreBackoff: true })
}

/** Dipasang sekali dari `PosApp`. */
export function useSyncTriggers(): void {
  React.useEffect(() => installSyncTriggers((trigger) => runSync(trigger)), [])
}

'use client'

import * as React from 'react'

import { useSyncStore } from '@/features/pos/sync/sync-store'
import { PosApiError } from '@/lib/api/errors'
import type { SyncTrigger } from '@/lib/db/models'
import { resetFailureCounter } from '@/lib/sync/backoff'
import { syncUp } from '@/lib/sync/sync-engine'
import { installSyncTriggers } from '@/lib/sync/sync-triggers'
import { nowIso } from '@/lib/time'

/**
 * Pesan untuk device token yang ditolak server.
 *
 * Backend menjawab `"Akses ditolak: Token tidak valid atau sudah kedaluwarsa"`
 * — benar secara teknis, tetapi tidak memberi tahu kasir apa yang harus
 * dilakukan. Penyebabnya selalu sama dan remedinya selalu sama: perangkat
 * harus diikat ulang.
 */
export const DEVICE_REJECTED_MESSAGE =
  'Perangkat ini ditolak server. Token pemasangannya tidak sah atau sudah dicabut — ' +
  'perangkat perlu dipasang ulang oleh teknisi. Data penjualan tetap aman di perangkat.'

/** Menjalankan sync dan memantulkan hasilnya ke store tampilan. */
export async function runSync(
  trigger: SyncTrigger,
  options: { ignoreBackoff?: boolean } = {},
): Promise<void> {
  const store = useSyncStore.getState()

  // Penolakan device token bersifat **deterministik**: mencoba lagi tidak akan
  // pernah berhasil sampai perangkat di-binding ulang. Pemicu otomatis
  // dihentikan agar tidak menyerbu server dengan percobaan yang pasti gagal;
  // tombol manual tetap boleh mencoba, karena itulah cara memastikan binding
  // baru sudah berhasil.
  if (store.deviceRejected && trigger !== 'manual') return

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
    } else if (result.quarantined > 0) {
      // Karantina lebih mendesak daripada kegagalan biasa: ia tidak akan hilang
      // sendiri. Pesannya menyebut tindakan, bukan sekadar jumlah.
      store.setError(
        `${result.quarantined} baris ditolak permanen dan butuh tindakan — buka daftar di bawah.`,
      )
    } else {
      store.setError(
        result.failedTransactionIds.length
          ? `${result.failedTransactionIds.length} transaksi ditolak server.`
          : 'Sebagian data belum tersimpan di server.',
      )
    }
  } catch (error) {
    if (error instanceof PosApiError && error.isUnauthorized) {
      useSyncStore.getState().setDeviceRejected(true)
      useSyncStore.getState().setError(DEVICE_REJECTED_MESSAGE)
      return
    }
    useSyncStore
      .getState()
      .setError(error instanceof Error ? error.message : 'Sinkronisasi gagal')
  } finally {
    useSyncStore.getState().setSyncing(false)
  }
}

/**
 * Tombol manual P-13 — selalu tersedia dan mengabaikan backoff.
 *
 * Penanda penolakan dibersihkan lebih dulu supaya percobaan manual benar-benar
 * berjalan; bila token masih tidak sah, ia akan ditandai lagi.
 */
export const runManualSync = (): Promise<void> => {
  resetFailureCounter()
  useSyncStore.getState().setDeviceRejected(false)
  return runSync('manual', { ignoreBackoff: true })
}

/** Dipasang sekali dari `PosApp`. */
export function useSyncTriggers(): void {
  React.useEffect(() => installSyncTriggers((trigger) => runSync(trigger)), [])
}

'use client'

import * as React from 'react'

import {
  flushPrintQueue,
  getPrintQueueServerSnapshot,
  getPrintQueueSnapshot,
  refreshPrintQueue,
  setOnPrintAbandoned,
  subscribePrintQueue,
  type PrintQueueSnapshot,
} from '@/lib/printer/print-queue'

/**
 * Jembatan React ke `lib/printer/print-queue` ([11 §M14.1]).
 *
 * Memakai `useSyncExternalStore` dengan alasan yang sama seperti store
 * konektivitas: antreannya hidup di luar React, dan berlangganan lewat efek
 * membuat render pertama memakai nilai basi selama satu frame — cukup lama
 * untuk membuat banner berkedip setiap kali layar berpindah.
 */
export function usePrintQueue(): PrintQueueSnapshot {
  return React.useSyncExternalStore(
    subscribePrintQueue,
    getPrintQueueSnapshot,
    getPrintQueueServerSnapshot,
  )
}

/** Hanya jumlahnya — komponen yang menggambar angka tidak perlu tahu sisanya. */
export function useUnprintedCount(): number {
  return React.useSyncExternalStore(
    subscribePrintQueue,
    () => getPrintQueueSnapshot().unprinted,
    () => getPrintQueueServerSnapshot().unprinted,
  )
}

/**
 * Dipasang sekali dari `PosApp`.
 *
 * Dua tugas:
 *
 *  1. **Membaca ulang hitungan saat aplikasi dibuka.** Job yang tertinggal dari
 *     sesi sebelumnya harus langsung terlihat, bukan menunggu pembatalan
 *     berikutnya.
 *  2. **Mencoba mengirim ulang** apa yang masih `PENDING`. Printer yang mati
 *     kemarin mungkin sudah hidup hari ini, dan kasir tidak perlu tahu bahwa
 *     ada yang perlu ditekan.
 *
 * ⚠️ Job berstatus `ABANDONED` **tidak** ikut dikirim ulang otomatis. Ia sudah
 * menghabiskan jatah percobaannya; mencobanya lagi tanpa ada yang berubah hanya
 * mengulang kegagalan yang sama. Kasir yang menekan "Cetak Ulang" di P-13
 * adalah perubahan itu.
 */
export function usePrintQueueWatcher(
  onAbandoned?: (jobKind: string, reason: string) => void,
): void {
  React.useEffect(() => {
    void refreshPrintQueue().then(() => flushPrintQueue())
  }, [])

  React.useEffect(() => {
    if (!onAbandoned) return
    return setOnPrintAbandoned((job, reason) => onAbandoned(job.kind, reason))
  }, [onAbandoned])
}

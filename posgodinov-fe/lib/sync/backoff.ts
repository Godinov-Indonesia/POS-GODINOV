/**
 * Backoff eksponensial — docs/05 §1.6.4.
 *
 * ⚠️ **Tidak ada batas percobaan.** Setelah sekian kegagalan, interval berhenti
 * bertambah di 5 menit dan mesin **terus mencoba selamanya**. Baris yang
 * berulang kali gagal dinaikkan ke P-13 sebagai peringatan yang terlihat,
 * tetapi tidak pernah dibuang. Ini data keuangan; menyerah bukan pilihan.
 */

import { getMeta, setMeta } from '@/lib/db/repositories/meta.repo'

const BASE_DELAY_MS = 5_000
const MAX_DELAY_MS = 5 * 60_000
const JITTER_RATIO = 0.2

/** Jitter ±20% mencegah banyak perangkat satu outlet menyerbu server serempak. */
export function nextDelay(consecutiveFailures: number): number {
  const raw = Math.min(BASE_DELAY_MS * 2 ** (consecutiveFailures - 1), MAX_DELAY_MS)
  const jitter = raw * JITTER_RATIO * (Math.random() * 2 - 1)
  return Math.round(raw + jitter)
}

let consecutiveFailures = 0

export async function getBackoffUntil(): Promise<number> {
  return (await getMeta<number>('sync.backoffUntil')) ?? 0
}

export async function recordFailure(): Promise<number> {
  consecutiveFailures += 1
  const delay = nextDelay(consecutiveFailures)
  await setMeta('sync.backoffUntil', Date.now() + delay)
  return delay
}

export async function clearBackoff(): Promise<void> {
  consecutiveFailures = 0
  await setMeta('sync.backoffUntil', 0)
}

/** Tombol manual di P-13 selalu tersedia dan **mengabaikan** backoff. */
export const resetFailureCounter = (): void => {
  consecutiveFailures = 0
}

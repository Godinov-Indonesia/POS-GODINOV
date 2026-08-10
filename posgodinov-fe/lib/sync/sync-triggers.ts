/**
 * Pemicu sinkronisasi — docs/05 §1.6.4.
 *
 * | Pemicu              | Catatan                                                        |
 * |---------------------|----------------------------------------------------------------|
 * | Koneksi kembali     | Jeda 2 detik — `online` sering menyala sebelum jaringan dipakai |
 * | Berkala             | 5 menit; dilewati saat `document.hidden` demi baterai           |
 * | Tutup shift         | Dipanggil langsung dari P-12 — laci sudah dihitung              |
 * | Manual              | Tombol P-13, **mengabaikan** backoff                            |
 * | Startup             | Menangkap antrean dari sesi sebelumnya                          |
 * | Tab kembali terlihat| Menangkap tab yang lama di-suspend                              |
 */

import type { SyncTrigger } from '@/lib/db/models'

const INTERVAL_MS = 5 * 60_000
const ONLINE_SETTLE_MS = 2_000

/**
 * Berkas ini hanya menjadwalkan; **runner-nya disuntikkan**. Memanggil
 * `syncUp` langsung dari sini akan melewati pembaruan store tampilan, sehingga
 * indikator "sedang menyinkronkan" di StatusBar tidak pernah padam.
 */
export type SyncRunner = (trigger: SyncTrigger) => void | Promise<void>

export function installSyncTriggers(runner: SyncRunner): () => void {
  const run = (trigger: SyncTrigger) => {
    // Kegagalan sengaja ditelan di sini: mesin sync sudah mencatat backoff dan
    // pesan galat per-baris. Melemparkannya ke listener global hanya
    // menghasilkan derau di konsol kasir.
    void Promise.resolve(runner(trigger)).catch(() => {})
  }

  const onOnline = () => setTimeout(() => run('online'), ONLINE_SETTLE_MS)
  const onVisibility = () => {
    if (!document.hidden && navigator.onLine) run('interval')
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibility)

  const timer = setInterval(() => {
    if (!document.hidden) run('interval')
  }, INTERVAL_MS)

  run('startup')

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
    clearInterval(timer)
  }
}

/**
 * Pemicu sinkronisasi — docs/05 §1.6.4, diperluas pada Fase M12.2
 * ([11 §M12.2]).
 *
 * | Pemicu               | Catatan                                                         |
 * |----------------------|-----------------------------------------------------------------|
 * | `startup`            | Menangkap antrean dari sesi sebelumnya                           |
 * | `reconnect`          | Jeda 2 detik — `online` sering menyala sebelum jaringan dipakai   |
 * | `interval`           | 5 menit; dilewati saat `document.hidden` demi baterai            |
 * | `transaction-commit` | **BARU** — debounce 1,5 detik setelah commit Dexie berhasil       |
 * | `void` / `return`    | **BARU** — pembatalan wajib sampai ke server secepat penjualan    |
 * | `shift-close`        | Dipanggil langsung dari P-12 — laci sudah dihitung               |
 * | `manual`             | Tombol P-13, **mengabaikan** backoff                             |
 * | `visibility`         | Tab kembali terlihat setelah lama di-suspend                     |
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUTIR 2 — AUTO-PUSH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sebelumnya transaksi menunggu putaran berkala berikutnya — sampai lima menit
 * — atau tombol manual. Kini setiap commit menjadwalkan pengiriman sendiri.
 */

import { onCommit, type CommitKind } from '@/lib/sync/commit-notifier'
import type { SyncTrigger } from '@/lib/db/models'

const INTERVAL_MS = 5 * 60_000
const RECONNECT_SETTLE_MS = 2_000

/**
 * Jendela penggabungan setelah sebuah commit.
 *
 * 1,5 detik dipilih dari dua arah sekaligus:
 *
 * - **Cukup lama** untuk menggabungkan transaksi beruntun pada jam sibuk. Tanpa
 *   jendela ini, sepuluh struk dalam dua puluh detik menghasilkan sepuluh
 *   `POST /v1/pos/sync` — masing-masing membawa ulang shift induk yang sama,
 *   dan masing-masing membuka koneksi baru pada jaringan outlet yang sempit.
 * - **Cukup singkat** agar kasir yang menyelesaikan transaksi terakhir lalu
 *   langsung menutup shift tidak menunggu. Jendela ini juga tidak menahan
 *   apa pun: barisnya sudah aman di Dexie sejak milidetik pertama.
 */
const COMMIT_DEBOUNCE_MS = 1_500

/** Tag yang sama dengan yang disimak service worker. */
const BACKGROUND_SYNC_TAG = 'posgodinov-sync'

/**
 * Berkas ini hanya menjadwalkan; **runner-nya disuntikkan**. Memanggil
 * `syncUp` langsung dari sini akan melewati pembaruan store tampilan, sehingga
 * indikator "sedang menyinkronkan" di StatusBar tidak pernah padam.
 */
export type SyncRunner = (trigger: SyncTrigger) => void | Promise<void>

/** Commit mana menghasilkan pemicu mana. */
const TRIGGER_BY_COMMIT: Record<CommitKind, SyncTrigger> = {
  transaction: 'transaction-commit',
  void: 'void',
  return: 'return',
  // Waste, shift, dan peristiwa keamanan ikut menumpang jendela yang sama:
  // ketiganya tidak mendesak sendiri, tetapi tidak ada alasan menahannya
  // sampai putaran berkala berikutnya bila koneksi memang sedang hidup.
  waste: 'transaction-commit',
  shift: 'transaction-commit',
  'security-event': 'transaction-commit',
}

export function installSyncTriggers(runner: SyncRunner): () => void {
  const run = (trigger: SyncTrigger) => {
    // Kegagalan sengaja ditelan di sini: mesin sync sudah mencatat backoff dan
    // pesan galat per-baris. Melemparkannya ke listener global hanya
    // menghasilkan derau di konsol kasir.
    void Promise.resolve(runner(trigger)).catch(() => {})
  }

  // ── Jaringan kembali ──────────────────────────────────────────────────────
  const onOnline = () => setTimeout(() => run('reconnect'), RECONNECT_SETTLE_MS)

  const onVisibility = () => {
    if (!document.hidden) run('visibility')
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibility)

  const timer = setInterval(() => {
    if (!document.hidden) run('interval')
  }, INTERVAL_MS)

  // ── Auto-push setelah commit ──────────────────────────────────────────────
  //
  // Satu timer bersama untuk SELURUH commit dalam jendela: sepuluh transaksi
  // beruntun menjadwalkan ulang timer yang sama, bukan sepuluh timer.
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let pendingTrigger: SyncTrigger = 'transaction-commit'

  const unsubscribeCommit = onCommit((kind) => {
    const trigger = TRIGGER_BY_COMMIT[kind] ?? 'transaction-commit'

    // Pembatalan menang atas penjualan biasa ketika keduanya jatuh di jendela
    // yang sama. Bukan soal kecepatan — keduanya terkirim di batch yang sama —
    // melainkan agar `syncLog` mencatat alasan yang paling layak ditelusuri.
    if (trigger !== 'transaction-commit') pendingTrigger = trigger

    if (commitTimer !== null) clearTimeout(commitTimer)
    commitTimer = setTimeout(() => {
      commitTimer = null
      const trig = pendingTrigger
      pendingTrigger = 'transaction-commit'
      run(trig)
    }, COMMIT_DEBOUNCE_MS)
  })

  // ── Background Sync — lapis CADANGAN ──────────────────────────────────────
  void registerBackgroundSync()
  const unsubscribeSw = listenForServiceWorkerSync(run)

  run('startup')

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
    clearInterval(timer)
    if (commitTimer !== null) clearTimeout(commitTimer)
    unsubscribeCommit()
    unsubscribeSw()
  }
}

/**
 * Mendaftarkan Background Sync bila peramban mendukungnya.
 *
 * ⚠️ **Bukan pengganti mesin sync di halaman** (ADR-06 tetap berlaku). Service
 * worker tidak menjalankan pengiriman sendiri — ia hanya membangunkan klien
 * yang masih terbuka. Nilainya nyata tetapi terbatas: menangkap momen koneksi
 * kembali saat tab POS ada di latar dan timer berkalanya sedang dimatikan.
 *
 * Chromium-only per hari ini; kegagalan pendaftaran diabaikan diam-diam karena
 * ini memang lapis cadangan.
 */
async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> }
    }).sync
    if (!sync) return
    await sync.register(BACKGROUND_SYNC_TAG)
  } catch {
    // Tidak didukung, izin ditolak, atau SW belum siap — abaikan.
  }
}

/** Menyimak permintaan sinkronisasi yang dikirim service worker. */
function listenForServiceWorkerSync(run: (trigger: SyncTrigger) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'posgodinov:sync-requested') run('reconnect')
  }

  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}

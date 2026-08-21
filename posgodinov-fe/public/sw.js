/* eslint-disable no-undef */
/**
 * Service worker POS — docs/05 §1.5.2, direvisi pada Fase M12.1 ([11 §M12.1]).
 *
 * Ditulis tangan, bukan hasil `workbox injectManifest`. Alasannya praktis:
 * `injectManifest` menuntut langkah build tambahan yang kompatibilitasnya
 * dengan Next 16 + Turbopack belum terverifikasi ([05 §0.5]). Strategi runtime
 * di bawah tidak memerlukan manifest build sama sekali, sehingga tidak ada
 * yang dapat rusak diam-diam saat nama berkas hasil build berubah.
 *
 * ATURAN PENYARINGAN (butir kunci [05 §1.1.1 #2]):
 * - `/pos/*`     → di-precache dan dilayani offline.
 * - `/admin/*`   → **isinya tidak pernah di-cache**. Data Admin bersifat
 *                  per-tenant; menyimpannya di perangkat kasir bersama adalah
 *                  kebocoran, bukan optimasi. Navigasinya boleh mendapat
 *                  halaman fallback statis — halaman itu tidak memuat data
 *                  siapa pun.
 * - `/v1/*`      → tidak pernah disentuh. Sinkronisasi dikelola mesin sync
 *                  sendiri (ADR-06) yang membutuhkan response asli.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUTIR 1 — MENGAPA POS "KELUAR SENDIRI" SETELAH SINKRONISASI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Versi sebelumnya mengembalikan dokumen `/pos/offline` sebagai fallback untuk
 * SETIAP navigasi POS yang tidak ditemukan di cache. `/pos/offline` adalah
 * **rute Next sungguhan** — sebuah dokumen terpisah. Begitu peramban
 * menerimanya untuk sebuah permintaan navigasi, ia MEMUAT DOKUMEN BARU:
 * seluruh state dalam memori (keranjang Zustand, layar aktif
 * `usePosRouterStore`, sesi kasir) dibuang, dan kasir mendarat di halaman statis
 * berisi tautan "Kembali ke Kasir". Bagi kasir, itu persis terlihat seperti
 * aplikasi keluar sendiri.
 *
 * Dua akar penyebabnya, keduanya diperbaiki di berkas ini:
 *
 *   1. **`caches.match(request)` mencocokkan query string.** Navigasi ke
 *      `/pos?x=1` — yang muncul dari tautan, pemindai QR, atau `history` yang
 *      dipulihkan peramban — MELESET dari entri cache `/pos`, lalu jatuh ke
 *      fallback. Diperbaiki dengan `ignoreSearch: true`.
 *   2. **Fallback-nya salah dokumen.** Navigasi di dalam scope `/pos` kini
 *      mengembalikan **shell `/pos`** dari cache. Aplikasi tetap hidup, router
 *      internal mengambil alih dari `location.hash`, dan tidak ada state yang
 *      hilang.
 *
 * `/pos/offline` dipertahankan **hanya** untuk navigasi di LUAR scope POS.
 */

const VERSION = 'v2'
const SHELL_CACHE = `posgodinov-shell-${VERSION}`
const ASSET_CACHE = `posgodinov-assets-${VERSION}`

/** Dokumen yang harus tersedia dalam mode pesawat. */
const SHELL_URLS = ['/pos', '/pos/bind', '/pos/offline', '/manifest.webmanifest']

/** Dokumen yang mengambil alih ketika navigasi POS tidak ditemukan di cache. */
const POS_SHELL_URL = '/pos'

/** Halaman fallback untuk alamat DI LUAR scope POS. */
const OUT_OF_SCOPE_FALLBACK_URL = '/pos/offline'

/**
 * Tag Background Sync ([11 §M12.2]).
 *
 * ⚠️ Batas yang harus dinyatakan apa adanya: mesin sinkronisasi berjalan di
 * konteks HALAMAN, bukan di service worker (ADR-06 — seluruh nilai
 * `POST /v1/pos/sync` ada di response-nya, dan `BackgroundSyncPlugin` membuang
 * response). Karena itu peristiwa `sync` di sini hanya MEMBANGUNKAN klien yang
 * masih terbuka. Bila seluruh tab sudah tertutup, tidak ada yang dapat
 * dikerjakan — dan berpura-pura sebaliknya akan membuat kasir mengira antreannya
 * terkirim padahal tidak.
 */
const SYNC_TAG = 'posgodinov-sync'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `reload` menghindari mengambil salinan basi dari HTTP cache peramban.
      .then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('posgodinov-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** `/pos` dan seluruh turunannya — BUKAN `/positions` atau `/posX`. */
function isPosScope(pathname) {
  return pathname === '/pos' || pathname.startsWith('/pos/')
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API sengaja dilewatkan ke jaringan tanpa perantara.
  if (url.pathname.startsWith('/v1')) return

  // Aset build ber-hash bersifat immutable → cache-first.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  if (isPosScope(url.pathname) || url.pathname === '/manifest.webmanifest') {
    // Dokumen POS: jaringan dulu agar pembaruan terpasang, cache sebagai jaring
    // pengaman ketika perangkat benar-benar offline.
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  // ── Di LUAR scope POS ─────────────────────────────────────────────────────
  //
  // Hanya NAVIGASI yang disentuh, dan hanya untuk memberi halaman fallback saat
  // jaringan mati. Response-nya TIDAK PERNAH di-cache, sehingga aturan "data
  // Admin tidak boleh tersimpan di perangkat kasir" tetap utuh.
  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithFallback(request))
  }
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // `ignoreSearch` — INTI PERBAIKAN BUTIR 1.
    //
    // Tanpa opsi ini, `/pos?tab=x` meleset dari entri cache `/pos` dan jatuh ke
    // fallback, yang berarti dokumen dimuat ulang dan seluruh state kasir
    // hilang. Query string tidak pernah mengubah dokumen yang dilayani: seluruh
    // navigasi layar POS memakai HASH, bukan query ([05 §1.1.3]).
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached

    if (request.mode === 'navigate') {
      // Navigasi POS yang tidak dikenal → SHELL `/pos`, bukan `/pos/offline`.
      //
      // Aplikasi tetap hidup dan router internalnya mengambil alih. Alamat di
      // bilah URL memang tidak berubah, tetapi itu jauh lebih murah daripada
      // membuang keranjang yang sedang diisi di depan pelanggan.
      const shell = await caches.match(POS_SHELL_URL, { ignoreSearch: true })
      if (shell) return shell
    }

    throw new Error('Offline dan tidak ada salinan tersimpan')
  }
}

/**
 * Navigasi di luar scope POS: coba jaringan, jatuh ke halaman fallback statis.
 *
 * Tidak ada `cache.put` di sini — halaman Admin tidak boleh meninggalkan jejak
 * di perangkat kasir.
 */
async function networkOnlyWithFallback(request) {
  try {
    return await fetch(request)
  } catch {
    const fallback = await caches.match(OUT_OF_SCOPE_FALLBACK_URL)
    if (fallback) return fallback
    throw new Error('Offline dan tidak ada salinan tersimpan')
  }
}

/**
 * Background Sync — lapis CADANGAN, bukan jalur utama ([11 §M12.2]).
 *
 * Peristiwa ini membangunkan klien yang masih terbuka agar mesin sync di
 * halaman menjalankan satu putaran. Bila tidak ada klien sama sekali, tidak ada
 * yang bisa dilakukan: antrean tetap aman di IndexedDB dan akan terkirim pada
 * pembukaan aplikasi berikutnya.
 */
self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return
  event.waitUntil(notifyClientsToSync())
})

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clients) {
    client.postMessage({ type: 'posgodinov:sync-requested', tag: SYNC_TAG })
  }
}

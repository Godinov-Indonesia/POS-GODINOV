/* eslint-disable no-undef */
/**
 * Service worker POS — docs/05 §1.5.2.
 *
 * Ditulis tangan, bukan hasil `workbox injectManifest`. Alasannya praktis:
 * `injectManifest` menuntut langkah build tambahan yang kompatibilitasnya
 * dengan Next 16 + Turbopack belum terverifikasi ([05 §0.5]). Strategi runtime
 * di bawah tidak memerlukan manifest build sama sekali, sehingga tidak ada
 * yang dapat rusak diam-diam saat nama berkas hasil build berubah.
 *
 * ATURAN PENYARINGAN (butir kunci [05 §1.1.1 #2]):
 * - `/pos/*`     → di-precache dan dilayani offline.
 * - `/admin/*`   → **tidak pernah** disentuh. Data Admin bersifat per-tenant;
 *                  menyimpannya di cache perangkat kasir bersama adalah
 *                  kebocoran, bukan optimasi.
 * - `/v1/*`      → tidak pernah di-cache. Sinkronisasi dikelola mesin sync
 *                  sendiri (ADR-06) yang membutuhkan response asli.
 */

const VERSION = 'v1'
const SHELL_CACHE = `posgodinov-shell-${VERSION}`
const ASSET_CACHE = `posgodinov-assets-${VERSION}`

/** Dokumen yang harus tersedia dalam mode pesawat. */
const SHELL_URLS = ['/pos', '/pos/bind', '/pos/offline', '/manifest.webmanifest']

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

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Admin dan API sengaja dilewatkan ke jaringan tanpa perantara.
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/v1')) return

  // Aset build ber-hash bersifat immutable → cache-first.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  if (!url.pathname.startsWith('/pos') && url.pathname !== '/manifest.webmanifest') return

  // Dokumen POS: jaringan dulu agar pembaruan terpasang, cache sebagai jaring
  // pengaman ketika perangkat benar-benar offline.
  event.respondWith(networkFirst(request, SHELL_CACHE))
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
    const cached = await caches.match(request)
    if (cached) return cached

    // Navigasi ke alamat POS yang tidak tersimpan → halaman fallback.
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/pos/offline')
      if (fallback) return fallback
    }
    throw new Error('Offline dan tidak ada salinan tersimpan')
  }
}

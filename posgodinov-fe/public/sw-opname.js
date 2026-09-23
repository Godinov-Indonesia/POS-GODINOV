/* eslint-disable no-undef */
/**
 * Service worker modul Opname — **butir 4** ([11 §M16.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICE WORKER KEDUA, SCOPE `/opname`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Berkas ini SENGAJA terpisah dari `sw.js`, bukan cabang `if` di dalamnya.
 * Alasannya struktural, bukan gaya:
 *
 *   · Cache-nya berdiri sendiri (`posgodinov-opname-*`). Menghapus cache kasir
 *     tidak menyentuh gudang, dan sebaliknya.
 *   · Scope `/opname` berarti peramban TIDAK PERNAH memberi worker ini
 *     permintaan `/pos`. Isolasi ditegakkan peramban, bukan oleh kedisiplinan
 *     penulis kode.
 *   · Perangkat gudang dapat memasang PWA opname tanpa ikut memasang aplikasi
 *     kasir — dua ikon, dua scope, dua basis data.
 *
 * ⚠️ **`/v1/*` tidak pernah disentuh.** Draf hitungan hidup di Dexie, bukan di
 * cache HTTP. Menyimpan respons API di sini akan membuat layar hasil
 * menampilkan selisih dari penguncian KEMARIN — dan tidak ada yang menyadarinya
 * karena angkanya tampak masuk akal.
 */

const VERSION = 'v1'
const SHELL_CACHE = `posgodinov-opname-shell-${VERSION}`
const ASSET_CACHE = `posgodinov-opname-assets-${VERSION}`

/** Dokumen yang harus tersedia di gudang tanpa sinyal. */
const SHELL_URLS = ['/opname', '/opname/manifest.webmanifest']

/** Dokumen yang mengambil alih saat navigasi opname tidak ditemukan di cache. */
const OPNAME_SHELL_URL = '/opname'

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
            // Prefiks `posgodinov-opname-` — BUKAN `posgodinov-`.
            //
            // Menyapu dengan prefiks yang lebih pendek akan membuat worker ini
            // menghapus cache shell KASIR setiap kali ia aktif, dan perangkat
            // yang memasang keduanya kehilangan kemampuan offline kasirnya
            // tanpa satu pun galat.
            .filter((key) => key.startsWith('posgodinov-opname-') && !key.endsWith(VERSION))
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

  // API dilewatkan ke jaringan tanpa perantara — lihat catatan kepala berkas.
  if (url.pathname.startsWith('/v1')) return

  // Aset build ber-hash bersifat immutable → cache-first.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // Dokumen opname: jaringan dulu agar pembaruan terpasang, cache sebagai jaring
  // pengaman ketika perangkat benar-benar offline.
  //
  // Tidak ada cabang "di luar scope" seperti pada `sw.js`: scope pendaftaran
  // sudah `/opname`, sehingga peramban tidak pernah mengirimkan permintaan lain
  // ke sini. Menambahkannya hanya akan menjadi kode mati yang menyesatkan
  // pembaca berikutnya.
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
    // `ignoreSearch` — pelajaran yang sama dengan `sw.js` ([11 §M12.1]).
    //
    // Tanpa opsi ini, `/opname?x=1` meleset dari entri cache `/opname` lalu
    // memuat dokumen baru, dan hitungan yang belum sempat tersimpan hilang.
    // Seluruh navigasi layar opname memakai HASH, bukan query.
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached

    if (request.mode === 'navigate') {
      const shell = await caches.match(OPNAME_SHELL_URL, { ignoreSearch: true })
      if (shell) return shell
    }

    throw new Error('Offline dan tidak ada salinan tersimpan')
  }
}

/**
 * Browser Image Cache Manager berbasis Cache Storage API (W3C standard).
 *
 * Mengelola penyimpanan lokal binary gambar produk di browser:
 * - Pre-download seluruh gambar produk berdasarkan outlet aktif.
 * - Inkremental caching: Hanya mengunduh gambar yang belum ada di cache.
 * - Mendukung akses offline & zero-latency rendering di UI POS/Admin.
 */

const CACHE_NAME = 'posgodinov-product-images-v1'

export function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window
}

/**
 * Mengambil Blob Object URL dari Cache Storage jika sudah tersimpan secara lokal.
 * Mengembalikan null jika belum ada di cache atau Cache API tidak didukung.
 */
export async function getCachedImageBlobUrl(url: string): Promise<string | null> {
  if (!url || !isCacheStorageAvailable()) return null

  try {
    const cache = await caches.open(CACHE_NAME)
    const match = await cache.match(url)
    if (!match) return null

    const blob = await match.blob()
    return URL.createObjectURL(blob)
  } catch (err) {
    console.warn('[ImageCache] Gagal membaca dari cache:', err)
    return null
  }
}

/**
 * Menyimpan satu URL gambar ke Cache Storage jika belum ada.
 * Mengembalikan true jika berhasil disimpan atau sudah ada di cache.
 */
export async function cacheImage(url: string): Promise<boolean> {
  if (!url || !isCacheStorageAvailable()) return false

  try {
    const cache = await caches.open(CACHE_NAME)
    const existing = await cache.match(url)
    if (existing) {
      return true
    }

    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) {
      console.warn(`[ImageCache] Gagal mengunduh gambar (HTTP ${response.status}):`, url)
      return false
    }

    await cache.put(url, response)
    return true
  } catch (err) {
    console.warn('[ImageCache] Gagal menyimpan gambar ke cache:', err)
    return false
  }
}

/**
 * Menghapus URL gambar dari cache (misalnya saat produk dihapus).
 */
export async function evictCachedImage(url: string): Promise<boolean> {
  if (!url || !isCacheStorageAvailable()) return false

  try {
    const cache = await caches.open(CACHE_NAME)
    return await cache.delete(url)
  } catch (err) {
    console.warn('[ImageCache] Gagal menghapus dari cache:', err)
    return false
  }
}

/**
 * Sinkronisasi inkremental seluruh gambar produk outlet ke cache browser.
 *
 * Mekanisme Inkremental:
 * 1. Mengecek URL mana saja yang SUDAH ada di cache.
 * 2. Hanya mengunduh URL yang BELUM ada di cache (menghindari download ulang).
 * 3. Menggunakan pembatasan konkurensi (default 3 paralel) agar tidak membebani browser thread.
 */
export async function syncOutletImages(
  urls: string[],
  concurrency = 3,
): Promise<{ cached: number; existing: number; failed: number }> {
  if (!isCacheStorageAvailable() || !urls.length) {
    return { cached: 0, existing: 0, failed: 0 }
  }

  // Deduplikasi & filter URL valid
  const uniqueUrls = Array.from(new Set(urls.filter((u) => typeof u === 'string' && u.trim().startsWith('http'))))
  if (!uniqueUrls.length) {
    return { cached: 0, existing: 0, failed: 0 }
  }

  let existing = 0
  let cached = 0
  let failed = 0

  try {
    const cache = await caches.open(CACHE_NAME)
    const missingUrls: string[] = []

    // 1. Filter mana yang sudah ada
    for (const url of uniqueUrls) {
      const match = await cache.match(url)
      if (match) {
        existing++
      } else {
        missingUrls.push(url)
      }
    }

    // 2. Download yang belum ada dengan pembatasan konkurensi
    if (missingUrls.length > 0) {
      const queue = [...missingUrls]
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
          const targetUrl = queue.shift()
          if (!targetUrl) break

          try {
            const res = await fetch(targetUrl, { mode: 'cors' })
            if (res.ok) {
              await cache.put(targetUrl, res)
              cached++
            } else {
              failed++
            }
          } catch {
            failed++
          }
        }
      })

      await Promise.all(workers)
    }
  } catch (err) {
    console.warn('[ImageCache] Sinkronisasi gambar outlet gagal:', err)
  }

  return { cached, existing, failed }
}

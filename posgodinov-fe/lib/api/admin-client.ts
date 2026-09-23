/**
 * Klien Admin — terikat access token. docs/05 §1.4.3 (Mekanisme 3).
 *
 * Seluruh endpoint `/v1/business/*` melewati berkas ini. Backend dapat menolak
 * token lebih awal dari perkiraan klien (mis. jam klien mundur), sehingga satu
 * kali percobaan ulang setelah refresh adalah keharusan, bukan optimasi.
 *
 * HEADER X-Business-ID ([Postman Collection §Business Dashboard]):
 * Backend kini mewajibkan header ini pada setiap request `/v1/business/*`.
 * Nilainya berasal dari `business.id` pada response login yang sudah tersimpan
 * di session store. Header ini diinjeksi satu kali di sini — seluruh endpoint
 * admin melewati `withRetryOn401`, sehingga tidak ada titik lain yang perlu diubah.
 */

import { PosApiError } from '@/lib/api/errors'
import { request, requestList, type RequestOptions } from '@/lib/api/http'
import { refreshAccessToken } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'

/**
 * Membaca `business.id` dari session store dan melempar bila tidak ada.
 *
 * Kegagalan di sini berarti sesi tidak lengkap — sama bersifatnya dengan token
 * yang tidak ada, bukan kegagalan jaringan. Dikerjakan sebelum `fetch` agar
 * catch-block transport tidak menangkapnya sebagai galat jaringan.
 */
function businessIdHeader(): Record<string, string> {
  const businessId = useSessionStore.getState().business?.id
  if (!businessId) {
    throw new PosApiError(
      401,
      'Business ID tidak tersedia — silakan login ulang',
    )
  }
  return { 'X-Business-ID': businessId }
}

/**
 * Menggabungkan header X-Business-ID ke dalam opts sebelum request dijalankan.
 * Merge dilakukan di sini — bukan di dalam `withRetryOn401` — agar header
 * terbaca ulang saat percobaan ulang setelah refresh (token baru, ID tetap).
 */
function withBusinessId(opts: RequestOptions): RequestOptions {
  return {
    ...opts,
    headers: {
      ...opts.headers,
      ...businessIdHeader(),
    },
  }
}

async function withRetryOn401<T>(
  path: string,
  opts: RequestOptions,
  run: (o: RequestOptions) => Promise<T>,
): Promise<T> {
  try {
    return await run({ ...opts, auth: 'access' })
  } catch (e) {
    if (e instanceof PosApiError && e.isUnauthorized && !opts.__retried) {
      await refreshAccessToken() // melempar → logout paksa
      return run({ ...opts, auth: 'access', __retried: true })
    }
    throw e
  }
}

export function adminRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return withRetryOn401(path, withBusinessId(opts), (o) => request<T>(path, o))
}

/**
 * Pembungkus WAJIB untuk endpoint koleksi Admin ([05 §3.1]).
 * Tidak ada endpoint koleksi yang boleh memanggil `adminRequest<T[]>()`.
 */
export function adminRequestList<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  return withRetryOn401(path, withBusinessId(opts), (o) => requestList<T>(path, o))
}

/** Endpoint `/bulk` mengirim ARRAY TELANJANG, bukan objek berpembungkus ([03 §5.2]). */
export function adminBulk<T>(path: string, items: unknown[]): Promise<T[]> {
  return adminRequestList<T>(path, { method: 'POST', bareArrayBody: items })
}

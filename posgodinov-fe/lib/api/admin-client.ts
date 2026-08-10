/**
 * Klien Admin — terikat access token. docs/05 §1.4.3 (Mekanisme 3).
 *
 * Seluruh endpoint `/v1/business/*` melewati berkas ini. Backend dapat menolak
 * token lebih awal dari perkiraan klien (mis. jam klien mundur), sehingga satu
 * kali percobaan ulang setelah refresh adalah keharusan, bukan optimasi.
 */

import { PosApiError } from '@/lib/api/errors'
import { request, requestList, type RequestOptions } from '@/lib/api/http'
import { refreshAccessToken } from '@/lib/auth/session-manager'

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
  return withRetryOn401(path, opts, (o) => request<T>(path, o))
}

/**
 * Pembungkus WAJIB untuk endpoint koleksi Admin ([05 §3.1]).
 * Tidak ada endpoint koleksi yang boleh memanggil `adminRequest<T[]>()`.
 */
export function adminRequestList<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  return withRetryOn401(path, opts, (o) => requestList<T>(path, o))
}

/** Endpoint `/bulk` mengirim ARRAY TELANJANG, bukan objek berpembungkus ([03 §5.2]). */
export function adminBulk<T>(path: string, items: unknown[]): Promise<T[]> {
  return adminRequestList<T>(path, { method: 'POST', bareArrayBody: items })
}

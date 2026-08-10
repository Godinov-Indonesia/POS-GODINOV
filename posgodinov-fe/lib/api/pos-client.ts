/**
 * Klien POS — terikat device token. docs/05 §1.3, [03 §0].
 *
 * Device token berumur ~10 tahun dan tidak dapat dicabut; tidak ada refresh,
 * tidak ada pemulihan `401` selain binding ulang perangkat. Karena itu berkas
 * ini jauh lebih sederhana daripada `admin-client.ts`.
 *
 * Menggunakan device token pada `/v1/business/*` (atau sebaliknya) menghasilkan
 * `401` — pemeriksaan jenis token di backend bersifat ketat.
 */

import { request, requestList, type RequestOptions } from '@/lib/api/http'

export function posRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...opts, auth: 'device' })
}

export function posRequestList<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  return requestList<T>(path, { ...opts, auth: 'device' })
}

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
import { db } from '@/lib/db/dexie'
import { PosApiError } from '@/lib/api/errors'

export async function posRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const deviceTokenRow = await db.meta.get('device.token')
  const deviceToken = deviceTokenRow?.value as string | undefined
  if (!deviceToken) {
    throw new PosApiError(
      401,
      'Perangkat belum terikat. Silakan lakukan Device Binding di /pos/bind terlebih dahulu.',
      undefined,
      path,
    )
  }

  const headers = {
    ...opts.headers,
    Authorization: `Bearer ${deviceToken}`,
  }

  return request<T>(path, { ...opts, headers, auth: 'none' })
}

export async function posRequestList<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  const deviceTokenRow = await db.meta.get('device.token')
  const deviceToken = deviceTokenRow?.value as string | undefined
  if (!deviceToken) {
    throw new PosApiError(
      401,
      'Perangkat belum terikat. Silakan lakukan Device Binding di /pos/bind terlebih dahulu.',
      undefined,
      path,
    )
  }

  const headers = {
    ...opts.headers,
    Authorization: `Bearer ${deviceToken}`,
  }

  return requestList<T>(path, { ...opts, headers, auth: 'none' })
}


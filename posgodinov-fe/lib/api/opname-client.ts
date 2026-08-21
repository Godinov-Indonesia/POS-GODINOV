/**
 * Klien HTTP modul Opname — **butir 4** ([11 §M16.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KLIEN TERPISAH, DAN BUKAN KARENA DUPLIKASI ITU BAIK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `pos-client.ts` membaca token dari `db.meta` — database **kasir**. Memakainya
 * di modul gudang berarti perangkat opname membuka IndexedDB `posgodinov`, dan
 * seluruh isolasi yang dibangun `opname-dexie.ts` runtuh pada baris impor
 * pertama.
 *
 * Berkas ini karena itu membaca token dari `opnameDb.meta`. Bentuknya memang
 * mirip; yang berbeda adalah SATU-SATUNYA hal yang penting: database asalnya.
 *
 * Token yang dipakai di sini terbit dengan klaim `scope: 'OPNAME'`. Server
 * menolak `POST /v1/pos/sync` dari token tersebut dengan `403 SCOPE_FORBIDDEN`,
 * sehingga perangkat gudang tidak dapat menyentuh jalur kasir bahkan lewat
 * `curl`.
 */

import { request, type RequestOptions } from '@/lib/api/http'
import { PosApiError } from '@/lib/api/errors'
import { opnameDb } from '@/lib/db/opname-dexie'

async function opnameToken(path: string): Promise<string> {
  const row = await opnameDb.meta.get('device.token')
  const token = row?.value as string | undefined
  if (!token) {
    throw new PosApiError(
      401,
      'Perangkat opname belum terikat. Hubungi teknisi untuk memasang perangkat ini.',
      undefined,
      path,
    )
  }
  return token
}

export async function opnameRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await opnameToken(path)

  const staffRow = await opnameDb.meta.get('session.active')
  const staffId = (staffRow?.value as { staffId?: string } | undefined)?.staffId

  return request<T>(path, {
    ...opts,
    headers: {
      ...opts.headers,
      Authorization: `Bearer ${token}`,
      // Identitas penghitung ikut di header, bukan di body.
      //
      // Petugas yang mengetik id orang lain ke dalam body akan menandatangani
      // hitungan atas nama mereka; header diisi klien dari sesi yang sudah
      // diverifikasi PIN, bukan dari isian mana pun.
      ...(staffId ? { 'X-Staff-Id': staffId } : {}),
    },
    auth: 'none',
  })
}

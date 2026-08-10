/**
 * Endpoint outlet — docs/03 §3.
 *
 * ⚠️ Tidak ada `PUT` maupun `DELETE`. Nama dan alamat outlet **tidak dapat
 * diubah** setelah dibuat; UI wajib menyembunyikan aksi tersebut ([05 §3.5]).
 */

import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { CreateOutletRequest, Outlet } from '@/lib/types/api'

/** Sumber data outlet switcher Dashboard. Diurutkan `created_at ASC`. */
export const listOutlets = (): Promise<Outlet[]> =>
  adminRequestList<Outlet>('/v1/business/outlets')

export const createOutlet = (body: CreateOutletRequest): Promise<Outlet> =>
  adminRequest<Outlet>('/v1/business/outlets', {
    method: 'POST',
    body: JSON.stringify(body),
  })

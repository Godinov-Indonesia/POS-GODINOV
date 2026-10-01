/**
 * Endpoint outlet — docs/03 §3.
 *
 * ⚠️ Tidak ada `PUT` maupun `DELETE`. Nama dan alamat outlet **tidak dapat
 * diubah** setelah dibuat; UI wajib menyembunyikan aksi tersebut ([05 §3.5]).
 */

import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { CreateOutletRequest, Outlet } from '@/lib/types/api'

export const listOutlets = async (): Promise<Outlet[]> => {
  const data = await adminRequestList<Outlet>('/v1/business/outlets')
  return data.map((o) => ({
    ...o,
    serial_tenant: o.serial_tenant || o.serial_outlet || '',
    serial_outlet: o.serial_outlet || o.serial_tenant || '',
  }))
}

export const createOutlet = async (body: CreateOutletRequest): Promise<Outlet> => {
  const o = await adminRequest<Outlet>('/v1/business/outlets', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return {
    ...o,
    serial_tenant: o.serial_tenant || o.serial_outlet || '',
    serial_outlet: o.serial_outlet || o.serial_tenant || '',
  }
}

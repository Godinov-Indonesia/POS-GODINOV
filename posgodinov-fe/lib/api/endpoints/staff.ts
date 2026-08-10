/**
 * Endpoint staff — docs/03 §4.
 *
 * ⚠️ Dua keanehan yang wajib diingat:
 * 1. `POST` mengirim `outlet_id` **di dalam body**, bukan di path — berbeda
 *    dari seluruh modul lain yang memakai `/outlets/{outlet_id}/…`.
 * 2. **PIN tidak dapat diubah** dan tidak ada endpoint reset PIN. Kasir yang
 *    lupa PIN harus dihapus lalu dibuat ulang ([03 §4.4] `[NEEDS DISCUSSION]`).
 */

import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { CreateStaffRequest, OutletId, Staff, UpdateStaffRequest } from '@/lib/types/api'

/** Seluruh staff di semua outlet milik bisnis. Diurutkan `created_at DESC`. */
export const listAllStaff = (): Promise<Staff[]> => adminRequestList<Staff>('/v1/business/staff')

/** Staff pada satu outlet. Memverifikasi kepemilikan outlet. */
export const listStaffByOutlet = (outletId: OutletId): Promise<Staff[]> =>
  adminRequestList<Staff>(`/v1/business/outlets/${outletId}/staff`)

export const createStaff = (body: CreateStaffRequest): Promise<Staff> =>
  adminRequest<Staff>('/v1/business/staff', { method: 'POST', body: JSON.stringify(body) })

export const updateStaff = (staffId: string, body: UpdateStaffRequest): Promise<Staff> =>
  adminRequest<Staff>(`/v1/business/staff/${staffId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

/**
 * Soft delete (`is_deleted = true`). Response `200` **tanpa** field `data`.
 * Riwayat `shifts` dan `product_wastes` tetap merujuk staff ini.
 */
export const deleteStaff = (staffId: string): Promise<null> =>
  adminRequest<null>(`/v1/business/staff/${staffId}`, { method: 'DELETE' })

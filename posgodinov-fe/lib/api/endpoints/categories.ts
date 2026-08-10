/**
 * Endpoint kategori — docs/03 §5.
 *
 * ⚠️ **Tidak ada `PUT` maupun `DELETE`** — satu-satunya modul CRUD yang tidak
 * lengkap di backend. Kolom `is_deleted` ada di tabel tetapi tidak ada cara
 * mengaktifkannya, sehingga nama kategori yang salah ketik bersifat permanen.
 * UI wajib menyembunyikan tombol edit/hapus ([05 §3.5]).
 *
 * Kategori bersifat **per-outlet**, bukan per-bisnis: bisnis dengan 3 outlet
 * harus membuat kategori "Minuman" sebanyak 3 kali ([02 §2.4]).
 */

import { adminBulk, adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { Category, CreateCategoryRequest, OutletId } from '@/lib/types/api'

/** Diurutkan `name ASC`, hanya `is_deleted = false`. */
export const listCategories = (outletId: OutletId): Promise<Category[]> =>
  adminRequestList<Category>(`/v1/business/outlets/${outletId}/categories`)

export const createCategory = (
  outletId: OutletId,
  body: CreateCategoryRequest,
): Promise<Category> =>
  adminRequest<Category>(`/v1/business/outlets/${outletId}/categories`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

/**
 * Body adalah **array JSON telanjang**, bukan objek berpembungkus.
 * Bersifat all-or-nothing: satu nama kosong menggagalkan seluruh batch.
 */
export const createCategoriesBulk = (
  outletId: OutletId,
  items: CreateCategoryRequest[],
): Promise<Category[]> =>
  adminBulk<Category>(`/v1/business/outlets/${outletId}/categories/bulk`, items)

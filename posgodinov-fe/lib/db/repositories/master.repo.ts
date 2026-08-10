/**
 * Master data POS (staff, kategori, produk) — docs/05 §1.5.1.
 *
 * ⚠️ Produk di sini **tidak punya** `stock` maupun `recipes`. Master data POS
 * memang tidak memuatnya ([03 §2.2]), dan UI kasir dilarang menampilkan
 * ketersediaan stok.
 */

import { db } from '@/lib/db/dexie'
import type { LocalCategory, LocalProduct, LocalStaff } from '@/lib/db/models'

export const listProducts = (): Promise<LocalProduct[]> => db.products.orderBy('name').toArray()

export const listCategories = (): Promise<LocalCategory[]> =>
  db.categories.orderBy('name').toArray()

export const listStaffs = (): Promise<LocalStaff[]> =>
  db.staffs.orderBy('staff_identifier').toArray()

export const getProduct = (id: string): Promise<LocalProduct | undefined> => db.products.get(id)

/** Pencocokan `staff_identifier` bersifat tidak peka huruf besar-kecil. */
export async function findStaffByIdentifier(identifier: string): Promise<LocalStaff | undefined> {
  const normalized = identifier.trim().toLowerCase()
  if (!normalized) return undefined

  const all = await db.staffs.toArray()
  return all.find((staff) => staff.staff_identifier.toLowerCase() === normalized)
}

export const countProducts = (): Promise<number> => db.products.count()

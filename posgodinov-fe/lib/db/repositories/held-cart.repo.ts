/**
 * Pesanan ditahan (hold order) — docs/05 §1.5.1.
 *
 * **Murni lokal dan tidak pernah dikirim ke server.** Tidak ada endpoint
 * cart/checkout di backend ([05 §0.4]); seluruh konsep "pesanan tertahan" hidup
 * di perangkat ini saja. Menghapusnya setelah diambil kembali aman — belum ada
 * uang yang berpindah.
 */

import { db } from '@/lib/db/dexie'
import type { HeldCart, LocalTransactionItem } from '@/lib/db/models'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

export const listHeldCarts = (): Promise<HeldCart[]> =>
  db.heldCarts.orderBy('created_at').reverse().toArray()

export async function holdCart(params: {
  label: string
  staffId: string
  items: LocalTransactionItem[]
}): Promise<HeldCart> {
  const cart: HeldCart = {
    id: newUuid(),
    label: params.label,
    items: params.items,
    created_at: nowIso(),
    _staff_id: params.staffId,
  }

  await db.heldCarts.add(cart)
  return cart
}

export const getHeldCart = (id: string): Promise<HeldCart | undefined> => db.heldCarts.get(id)

export const removeHeldCart = (id: string): Promise<void> => db.heldCarts.delete(id)

export const countHeldCarts = (): Promise<number> => db.heldCarts.count()

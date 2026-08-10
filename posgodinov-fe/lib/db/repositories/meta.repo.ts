/**
 * Key-value internal POS — docs/05 §1.5.1.
 *
 * Tabel `meta` juga menampung `device.token`. Itu disengaja: IndexedDB tidak
 * terekspos ke `document.cookie` dan tidak ikut tersalin saat pengguna menyalin
 * `localStorage` ([05 §1.4.2]).
 */

import { db } from '@/lib/db/dexie'
import type { MetaKey } from '@/lib/db/models'
import { nowIso } from '@/lib/time'

export async function getMeta<T>(key: MetaKey): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: MetaKey, value: unknown): Promise<void> {
  await db.meta.put({ key, value, updated_at: nowIso() })
}

export async function deleteMeta(key: MetaKey): Promise<void> {
  await db.meta.delete(key)
}

/**
 * Sync-down master data — docs/05 §1.5.1, docs/04 §A.2.
 *
 * `bulkPut`, **tidak pernah** `clear()` lalu isi ulang: `clear()+bulkAdd`
 * menciptakan jendela waktu database kosong, dan bila proses terputus di
 * tengah, perangkat kehilangan seluruh master data — di tengah jam sibuk,
 * tanpa jaringan untuk memulihkannya.
 */

import { fetchMasterData } from '@/lib/api/endpoints/pos-sync'
import { MASTER_SYNC_STALE_MS } from '@/lib/constants/limits'
import { db } from '@/lib/db/dexie'
import { getMeta, setMeta } from '@/lib/db/repositories/meta.repo'
import { toMinor } from '@/lib/money'
import { nowIso } from '@/lib/time'

export type MasterSyncResult = {
  staffs: number
  categories: number
  products: number
  /** Baris master yang tidak ada lagi di payload terbaru dan ikut dibuang. */
  pruned: number
}

export async function syncMasterData(): Promise<MasterSyncResult> {
  const payload = await fetchMasterData()

  // Setiap koleksi bisa null ([03 §2.2]) — normalisasi WAJIB.
  const staffs = payload?.staffs ?? []
  const categories = payload?.categories ?? []
  const products = payload?.products ?? []

  const now = nowIso()
  let pruned = 0

  await db.transaction('rw', db.staffs, db.categories, db.products, db.meta, async () => {
    await db.staffs.bulkPut(staffs.map((s) => ({ ...s, _syncedAt: now })))
    await db.categories.bulkPut(categories.map((c) => ({ ...c, _syncedAt: now })))
    await db.products.bulkPut(
      products.map((p) => ({
        ...p,
        price: toMinor(p.price), // Rupiah desimal → integer sen (ADR-05)
        _syncedAt: now,
      })),
    )

    // REKONSILIASI BARIS YATIM ([05 §1.5.1]).
    //
    // Endpoint master data tidak mengirim daftar entitas terhapus, dan `bulkPut`
    // tidak membuang baris lama. Tanpa langkah ini, produk yang di-soft delete
    // di Dashboard akan tetap muncul di grid kasir selamanya. Baris yang
    // `_syncedAt`-nya lebih tua dari `now` berarti tidak ada di payload terbaru.
    //
    // Diterapkan HANYA pada tabel master — tidak pernah pada tabel transaksional.
    pruned += await db.staffs.where('_syncedAt').below(now).delete()
    pruned += await db.categories.where('_syncedAt').below(now).delete()
    pruned += await db.products.where('_syncedAt').below(now).delete()

    await db.meta.put({ key: 'master.lastSyncAt', value: now, updated_at: now })
  })

  return { staffs: staffs.length, categories: categories.length, products: products.length, pruned }
}

export const getLastMasterSyncAt = (): Promise<string | undefined> =>
  getMeta<string>('master.lastSyncAt')

/**
 * Kebijakan pemicu ([05 §1.5.1]): saat binding, saat aplikasi dibuka bila
 * berumur > 12 jam, dan lewat tombol manual di P-14. Tidak lebih sering —
 * setiap panggilan menarik **seluruh** katalog.
 */
export async function isMasterDataStale(): Promise<boolean> {
  const last = await getLastMasterSyncAt()
  if (!last) return true
  return Date.now() - new Date(last).getTime() > MASTER_SYNC_STALE_MS
}

export const markMasterSynced = (): Promise<void> => setMeta('master.lastSyncAt', nowIso())

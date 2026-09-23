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
  /** Versi yang kini benar-benar dipegang perangkat (butir 10). */
  version: number | null
}

export async function syncMasterData(): Promise<MasterSyncResult> {
  const payload = await fetchMasterData()

  // Setiap koleksi bisa null ([03 §2.2]) — normalisasi WAJIB.
  const staffs = payload?.staffs ?? []
  const categories = payload?.categories ?? []
  const products = payload?.products ?? []

  const now = nowIso()
  let pruned = 0

  await db.transaction('rw', [db.staffs, db.categories, db.products, db.meta], async () => {
    if (staffs.length > 0) {
      await db.staffs.bulkPut(staffs.map((s) => ({ ...s, _syncedAt: now })))
    }
    if (categories.length > 0) {
      await db.categories.bulkPut(categories.map((c) => ({ ...c, _syncedAt: now })))
    }
    if (products.length > 0) {
      await db.products.bulkPut(
        products.map((p) => ({
          ...p,
          price: toMinor(p.price), // Integer Sen
          _syncedAt: now,
        })),
      )
    }

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

    // ── BUTIR 10 — versi yang DIPEGANG perangkat ─────────────────────────
    //
    // Ditulis di dalam transaksi yang sama dengan datanya. Menulisnya di luar
    // membuka jendela di mana versi sudah tercatat tetapi katalognya belum —
    // dan gerbang Buka Shift akan meloloskan perangkat yang isinya justru
    // setengah jadi.
    //
    // `version` absen pada server pra-v2. Nilainya dibiarkan apa adanya alih
    // -alih ditimpa `null`: menimpanya akan MENGHAPUS versi sah yang sudah
    // dipegang perangkat hanya karena satu penarikan menemui backend lama.
    if (typeof payload?.version === 'number') {
      await db.meta.put({ key: 'master.version', value: payload.version, updated_at: now })
    }

    // Blok kebijakan ([11 §4.4]). Ikut satu transaksi karena ambang batas yang
    // tidak cocok dengan katalognya adalah keadaan yang sama berbahayanya
    // dengan katalog yang setengah tertulis.
    if (payload?.config && typeof payload.config === 'object') {
      await db.meta.put({ key: 'config', value: payload.config, updated_at: now })
    }
  })

  return {
    staffs: staffs.length,
    categories: categories.length,
    products: products.length,
    pruned,
    version: typeof payload?.version === 'number' ? payload.version : null,
  }
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

/**
 * Muara 1 — memuat fixture ke IndexedDB untuk uji **POS offline**.
 *
 * Jalur ini melewati backend sepenuhnya: setelah dijalankan, aplikasi kasir
 * dapat dibuka penuh dalam mode pesawat, persis seperti perangkat yang sudah
 * pernah menjalankan sinkronisasi master data.
 *
 * ⚠️ TIGA HAL YANG WAJIB DIPAHAMI PENGUJI
 * ---------------------------------------
 * 1. **Device token yang ditulis adalah palsu.** Ia hanya membuka gerbang UI
 *    (`isDeviceBound()`); setiap `POST /v1/pos/sync` dengannya akan dijawab
 *    `401`. Untuk menguji sinkronisasi sungguhan, lakukan binding nyata lewat
 *    `/pos/bind` — jangan memakai seeder ini.
 * 2. **Produk tidak membawa stok maupun resep.** Master data POS memang tidak
 *    memuatnya ([03 §2.2]); pemotongan stok terjadi di server saat sync.
 * 3. **Tabel transaksional tidak disentuh.** `shifts`, `transactions`, dan
 *    `wastes` adalah data keuangan — seeder tidak pernah menulis ke sana, dan
 *    `resetSeed()` tidak pernah menghapusnya.
 */

import bcrypt from 'bcryptjs'

import { db } from '@/lib/db/dexie'
import type { LocalCategory, LocalProduct, LocalStaff } from '@/lib/db/models'
import { setMeta } from '@/lib/db/repositories/meta.repo'
// `SEED_RAW_MATERIALS` sengaja TIDAK diimpor: bahan baku dan resep tidak pernah
// sampai ke perangkat kasir ([03 §2.2]). Mengisinya di sini akan menciptakan
// lingkungan uji yang lebih kaya daripada perangkat sungguhan.
import { SEED_CATEGORIES, SEED_OUTLET, SEED_PRODUCTS, SEED_STAFFS } from '@/lib/seed/fixtures'
import { nowIso } from '@/lib/time'

/**
 * Cost bcrypt backend adalah `DefaultCost` (10) ([04 §A.3]). Hash uji harus
 * memakai cost yang sama, bukan lebih rendah — kalau tidak, uji performa login
 * kasir menjadi tidak berarti.
 */
const BCRYPT_COST = 10

/** Penanda bahwa isi database berasal dari seeder, bukan sinkronisasi nyata. */
export const SEED_MARKER_KEY = 'device.outletLabel'

export type DexieSeedResult = {
  staffs: number
  categories: number
  products: number
  hashMs: number
}

export async function seedDexie(): Promise<DexieSeedResult> {
  const now = nowIso()

  // bcrypt disengaja dijalankan penuh (bukan hash yang ditanam) supaya cost-nya
  // selalu cocok dengan backend. Ini lambat — ±100-300ms per PIN — dan itulah
  // alasan login kasir memakai Web Worker (ADR-08).
  const startedAt = performance.now()
  const staffs: LocalStaff[] = SEED_STAFFS.map((staff) => ({
    id: staff.id,
    staff_identifier: staff.staff_identifier,
    name: staff.name,
    pin_hash: bcrypt.hashSync(staff.pin, BCRYPT_COST),
    _syncedAt: now,
  }))
  const hashMs = Math.round(performance.now() - startedAt)

  const categories: LocalCategory[] = SEED_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    _syncedAt: now,
  }))

  const products: LocalProduct[] = SEED_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    // Sudah dalam sen di fixture — TIDAK dikonversi lagi. Master data dari
    // server melewati `toMinor()` di `master-sync.ts`; fixture tidak.
    price: product.price_minor,
    image_url: product.image_url,
    category_id: product.category_id,
    _syncedAt: now,
  }))

  // `bulkPut` = upsert, sama seperti `master-sync.ts`. Menjalankan seeder dua
  // kali memperbarui baris yang sama karena UUID-nya tetap.
  await db.transaction('rw', db.staffs, db.categories, db.products, db.meta, async () => {
    await db.staffs.bulkPut(staffs)
    await db.categories.bulkPut(categories)
    await db.products.bulkPut(products)
  })

  await setMeta('seed.isSeeded', true)
  await setMeta('device.boundAt', now)
  await setMeta('device.outletLabel', SEED_OUTLET.name)
  await setMeta('master.lastSyncAt', now)

  return {
    staffs: staffs.length,
    categories: categories.length,
    products: products.length,
    hashMs,
  }
}

export type DexieResetResult = {
  masterRowsCleared: number
  transactionalRowsKept: number
}

/**
 * Mengosongkan **master data dan metadata perangkat saja**.
 *
 * Tabel transaksional sengaja dipertahankan: aturan [05 §1.5.1] menyatakan
 * baris tidak pernah dihapus setelah dibuat, dan sebuah utilitas uji bukan
 * alasan yang cukup untuk melanggarnya. Bila memang perlu memulai dari nol,
 * hapus seluruh database lewat DevTools → Application → IndexedDB.
 */
export async function resetSeed(): Promise<DexieResetResult> {
  const transactionalRowsKept =
    (await db.shifts.count()) + (await db.transactions.count()) + (await db.wastes.count())

  const masterRowsCleared =
    (await db.staffs.count()) + (await db.categories.count()) + (await db.products.count())

  await db.transaction('rw', db.staffs, db.categories, db.products, db.heldCarts, db.meta, async () => {
    await db.staffs.clear()
    await db.categories.clear()
    await db.products.clear()
    await db.heldCarts.clear()
    await db.meta.clear()
  })

  return { masterRowsCleared, transactionalRowsKept }
}

/** Apakah database saat ini berisi hasil seeder (bukan sinkronisasi nyata)? */
export async function isSeeded(): Promise<boolean> {
  const marker = await db.meta.get('seed.isSeeded')
  return marker?.value === true
}

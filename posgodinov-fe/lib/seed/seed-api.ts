/**
 * Muara 2 — mengirim fixture ke backend lewat API Admin.
 *
 * Dipakai untuk menyiapkan tenant uji sungguhan: setelah ini, perangkat POS
 * dapat melakukan binding nyata di `/pos/bind` dan menjalankan sinkronisasi
 * dua arah yang sebenarnya.
 *
 * ⚠️ EMPAT BATASAN YANG BERASAL DARI BACKEND, BUKAN DARI RANCANGAN INI
 * --------------------------------------------------------------------
 * 1. **UUID fixture tidak dipakai.** Server membangkitkan `id` sendiri untuk
 *    kategori, bahan baku, dan produk. Karena itu resep dipetakan **berdasarkan
 *    nama** — bukan berdasarkan ID fixture.
 * 2. **Tidak idempotent.** Kategori tidak punya `DELETE` maupun `PUT`
 *    ([03 §5.3]), sehingga menjalankan seeder dua kali pada outlet yang sama
 *    akan **menggandakan kategori secara permanen**. Seeder menolak berjalan
 *    bila outlet sudah berisi data, kecuali dipaksa.
 * 3. **Endpoint `/bulk` bersifat all-or-nothing.** Satu baris ditolak → seluruh
 *    batch dibatalkan.
 * 4. **Staff memerlukan PIN teks polos.** Backend yang melakukan hash.
 */

import { listCategories, createCategoriesBulk } from '@/lib/api/endpoints/categories'
import { createProductsBulk, listProducts } from '@/lib/api/endpoints/products'
import { createRawMaterialsBulk, listRawMaterials } from '@/lib/api/endpoints/raw-materials'
import { createStaff, listStaffByOutlet } from '@/lib/api/endpoints/staff'
import {
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_RAW_MATERIALS,
  SEED_STAFFS,
} from '@/lib/seed/fixtures'
import type { OutletId } from '@/lib/types/api'

export type ApiSeedResult = {
  categories: number
  rawMaterials: number
  products: number
  staffs: number
  skipped: string[]
}

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedGuardError'
  }
}

/**
 * Menolak menyemai outlet yang sudah berisi data.
 *
 * Bukan kehati-hatian berlebihan: kategori ganda **tidak dapat dihapus** lewat
 * API mana pun, sehingga satu kali salah jalan meninggalkan outlet yang kotor
 * selamanya.
 */
async function assertOutletEmpty(outletId: OutletId): Promise<void> {
  const [categories, rawMaterials, products] = await Promise.all([
    listCategories(outletId),
    listRawMaterials(outletId),
    listProducts(outletId),
  ])

  const existing: string[] = []
  if (categories.length) existing.push(`${categories.length} kategori`)
  if (rawMaterials.length) existing.push(`${rawMaterials.length} bahan baku`)
  if (products.length) existing.push(`${products.length} produk`)

  if (existing.length) {
    throw new SeedGuardError(
      `Outlet ${outletId} sudah berisi ${existing.join(', ')}. ` +
        'Seeder dibatalkan — kategori ganda tidak dapat dihapus lewat API. ' +
        'Pakai outlet baru, atau jalankan dengan opsi force bila Anda benar-benar bermaksud menambah.',
    )
  }
}

export async function seedViaApi(
  outletId: OutletId,
  options: { force?: boolean } = {},
): Promise<ApiSeedResult> {
  if (!options.force) await assertOutletEmpty(outletId)

  const skipped: string[] = []

  // ── 1. Kategori ─────────────────────────────────────────────────────────
  await createCategoriesBulk(
    outletId,
    SEED_CATEGORIES.map((category) => ({
      name: category.name,
      description: category.description,
    })),
  )

  // ── 2. Bahan baku ───────────────────────────────────────────────────────
  await createRawMaterialsBulk(
    outletId,
    SEED_RAW_MATERIALS.map((material) => ({
      name: material.name,
      unit: material.unit,
      package_unit: material.package_unit ?? undefined,
      quantity_per_package: material.quantity_per_package ?? undefined,
      stock: material.stock,
      cost_per_unit_minor: material.cost_per_unit_minor,
    })),
  )

  // ── 3. Baca ulang untuk memperoleh ID yang dibangkitkan server ──────────
  // Inilah alasan resep dipetakan berdasarkan nama: ID fixture tidak pernah
  // sampai ke database.
  const [categories, rawMaterials] = await Promise.all([
    listCategories(outletId),
    listRawMaterials(outletId),
  ])

  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  /** ID fixture → ID server, dijembatani lewat nama yang unik di fixture. */
  const rawMaterialIdByFixtureId = new Map<string, string>()
  for (const fixture of SEED_RAW_MATERIALS) {
    const match = rawMaterials.find((m) => m.name === fixture.name)
    if (match) rawMaterialIdByFixtureId.set(fixture.id, match.id)
  }

  // ── 4. Produk beserta resep ─────────────────────────────────────────────
  const productPayload = SEED_PRODUCTS.map((product) => {
    const recipes = product.recipes.flatMap((recipe) => {
      const serverId = rawMaterialIdByFixtureId.get(recipe.raw_material_id)
      if (!serverId) {
        // Membiarkan resep yatim lewat berarti produk tersimpan tanpa BOM dan
        // stoknya tidak pernah terpotong — kegagalan yang tidak terlihat.
        skipped.push(`Resep ${product.name}: bahan baku tidak ditemukan di server`)
        return []
      }
      return [{ raw_material_id: serverId, quantity: recipe.quantity }]
    })

    return {
      name: product.name,
      price_minor: product.price_minor,
      image_url: product.image_url ?? undefined,
      category_id: categoryIdByName.get(categoryNameOf(product.category_id)) ?? null,
      recipes,
    }
  })

  await createProductsBulk(outletId, productPayload)

  // ── 5. Staff ────────────────────────────────────────────────────────────
  // Tidak ada endpoint `/bulk` untuk staff, dan `staff_identifier` unik
  // per-outlet — yang sudah ada dilewati alih-alih menggagalkan seluruh seeder.
  const existingStaff = await listStaffByOutlet(outletId)
  const existingIdentifiers = new Set(existingStaff.map((s) => s.staff_identifier))

  let staffCreated = 0
  for (const staff of SEED_STAFFS) {
    if (existingIdentifiers.has(staff.staff_identifier)) {
      skipped.push(`Staff ${staff.staff_identifier} sudah ada`)
      continue
    }
    await createStaff({
      outlet_id: outletId,
      staff_identifier: staff.staff_identifier,
      name: staff.name,
      pin: staff.pin,
    })
    staffCreated += 1
  }

  return {
    categories: SEED_CATEGORIES.length,
    rawMaterials: SEED_RAW_MATERIALS.length,
    products: SEED_PRODUCTS.length,
    staffs: staffCreated,
    skipped,
  }
}

/** Fixture menyimpan `category_id` sebagai ID fixture; petakan balik ke namanya. */
function categoryNameOf(fixtureCategoryId: string): string {
  return SEED_CATEGORIES.find((c) => c.id === fixtureCategoryId)?.name ?? ''
}

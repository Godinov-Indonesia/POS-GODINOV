/**
 * Endpoint produk & BOM — docs/03 §6.
 *
 * Titik konversi uang ([05 §1.8.1]): `price` dan `raw_material.cost_per_unit`
 * datang sebagai Rupiah desimal dan langsung menjadi sen di sini.
 *
 * ⚠️ SEMANTIK UPDATE YANG WAJIB DIPATUHI ([03 §6.4]):
 * - `price` diperbarui bila ≥ 0 — mengirim `0` benar-benar menetapkan harga 0.
 * - `image_url` hanya diperbarui bila tidak kosong — **tidak dapat dikosongkan**.
 * - `category_id` **selalu ditimpa**, termasuk dengan `null`.
 * - `recipes` adalah **penggantian total**; menghilangkan field ini akan
 *   MENGHAPUS SELURUH RESEP. Frontend wajib selalu mengirim array lengkap.
 */

import { adminBulk, adminRequest, adminRequestList } from '@/lib/api/admin-client'
import { toRawMaterialView } from '@/lib/api/endpoints/raw-materials'
import { toMajor, toMinor } from '@/lib/money'
import type { CreateProductRequest, OutletId, Product } from '@/lib/types/api'
import type { ProductView } from '@/lib/types/domain'

export const toProductView = (dto: Product): ProductView => ({
  id: dto.id,
  outlet_id: dto.outlet_id,
  name: dto.name,
  price_minor: toMinor(dto.price),
  image_url: dto.image_url,
  category_id: dto.category_id,
  created_at: dto.created_at,
  updated_at: dto.updated_at,
  // `recipes` bisa `null` dari backend — normalisasi wajib ([05 §3.1]).
  recipes: (dto.recipes ?? []).map((recipe) => ({
    id: recipe.id,
    raw_material_id: recipe.raw_material_id,
    quantity: recipe.quantity,
    raw_material: recipe.raw_material ? toRawMaterialView(recipe.raw_material) : undefined,
  })),
  category: dto.category ?? null,
})

/** Berbeda dari master data POS, endpoint Admin ini menyertakan BOM lengkap. */
export async function listProducts(outletId: OutletId): Promise<ProductView[]> {
  const rows = await adminRequestList<Product>(`/v1/business/outlets/${outletId}/products`)
  return rows.map(toProductView)
}

export type ProductInput = {
  name: string
  /** Harga jual dalam **sen**. */
  price_minor: number
  image_url?: string
  category_id?: string | null
  /** Selalu kirim lengkap — backend mengganti total. */
  recipes: { raw_material_id: string; quantity: number }[]
}

const toWire = (input: ProductInput): CreateProductRequest => ({
  name: input.name,
  price: toMajor(input.price_minor),
  image_url: input.image_url,
  category_id: input.category_id,
  recipes: input.recipes,
})

export async function createProduct(
  outletId: OutletId,
  input: ProductInput,
): Promise<ProductView> {
  const dto = await adminRequest<Product>(`/v1/business/outlets/${outletId}/products`, {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  })
  return toProductView(dto)
}

export async function createProductsBulk(
  outletId: OutletId,
  items: ProductInput[],
): Promise<ProductView[]> {
  const rows = await adminBulk<Product>(
    `/v1/business/outlets/${outletId}/products/bulk`,
    items.map(toWire),
  )
  return rows.map(toProductView)
}

/**
 * `{outlet_id}` ada di path tetapi **diabaikan** backend — otorisasi ditempuh
 * lewat `product_id` → `outlet_id` → `business_id`. Tetap kirim nilai yang
 * benar agar konsisten ([03 §6.4]).
 */
export async function updateProduct(
  outletId: OutletId,
  productId: string,
  input: ProductInput,
): Promise<ProductView> {
  const dto = await adminRequest<Product>(
    `/v1/business/outlets/${outletId}/products/${productId}`,
    { method: 'PUT', body: JSON.stringify(toWire(input)) },
  )
  return toProductView(dto)
}

/** Soft delete. Baris `transaction_items` historis tetap merujuk produk ini. */
export const deleteProduct = (outletId: OutletId, productId: string): Promise<null> =>
  adminRequest<null>(`/v1/business/outlets/${outletId}/products/${productId}`, {
    method: 'DELETE',
  })

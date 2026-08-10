/**
 * Endpoint bahan baku — docs/03 §7.
 *
 * Berkas ini adalah salah satu dari tiga titik konversi uang ([05 §1.8.1]):
 * `cost_per_unit` datang sebagai Rupiah desimal dan langsung menjadi sen.
 *
 * ⚠️ `stock` **sengaja tidak ada** di payload update. Stok hanya berubah lewat
 * restock, waste, opname, atau sinkronisasi POS. Jangan menyediakan field
 * "edit stok" di UI — arahkan pengguna ke Stock Opname ([03 §7.4]).
 */

import { adminBulk, adminRequest, adminRequestList } from '@/lib/api/admin-client'
import { toMajor, toMinor } from '@/lib/money'
import type {
  CreateRawMaterialRequest,
  OutletId,
  RawMaterial,
  UpdateRawMaterialRequest,
} from '@/lib/types/api'
import type { RawMaterialView } from '@/lib/types/domain'

export const toRawMaterialView = (dto: RawMaterial): RawMaterialView => ({
  id: dto.id,
  outlet_id: dto.outlet_id,
  name: dto.name,
  unit: dto.unit,
  package_unit: dto.package_unit,
  quantity_per_package: dto.quantity_per_package,
  stock: dto.stock,
  cost_per_unit_minor: toMinor(dto.cost_per_unit),
  created_at: dto.created_at,
  updated_at: dto.updated_at,
})

/** Diurutkan `name ASC`, hanya `is_deleted = false`. */
export async function listRawMaterials(outletId: OutletId): Promise<RawMaterialView[]> {
  const rows = await adminRequestList<RawMaterial>(
    `/v1/business/outlets/${outletId}/raw-materials`,
  )
  return rows.map(toRawMaterialView)
}

export type RawMaterialInput = {
  name: string
  unit: string
  package_unit?: string
  quantity_per_package?: number
  /** Stok awal dalam base unit. Hanya berlaku saat pembuatan. */
  stock?: number
  /** HPP per base unit dalam **sen** — dikonversi ke Rupiah desimal di sini. */
  cost_per_unit_minor?: number
}

const toWire = (input: RawMaterialInput): CreateRawMaterialRequest => ({
  name: input.name,
  unit: input.unit,
  package_unit: input.package_unit,
  quantity_per_package: input.quantity_per_package,
  stock: input.stock,
  cost_per_unit:
    input.cost_per_unit_minor === undefined ? undefined : toMajor(input.cost_per_unit_minor),
})

export async function createRawMaterial(
  outletId: OutletId,
  input: RawMaterialInput,
): Promise<RawMaterialView> {
  const dto = await adminRequest<RawMaterial>(`/v1/business/outlets/${outletId}/raw-materials`, {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  })
  return toRawMaterialView(dto)
}

export async function createRawMaterialsBulk(
  outletId: OutletId,
  items: RawMaterialInput[],
): Promise<RawMaterialView[]> {
  const rows = await adminBulk<RawMaterial>(
    `/v1/business/outlets/${outletId}/raw-materials/bulk`,
    items.map(toWire),
  )
  return rows.map(toRawMaterialView)
}

export async function updateRawMaterial(
  outletId: OutletId,
  rawMaterialId: string,
  input: Omit<RawMaterialInput, 'stock'>,
): Promise<RawMaterialView> {
  const body: UpdateRawMaterialRequest = {
    name: input.name,
    unit: input.unit,
    package_unit: input.package_unit,
    quantity_per_package: input.quantity_per_package,
    cost_per_unit:
      input.cost_per_unit_minor === undefined ? undefined : toMajor(input.cost_per_unit_minor),
  }
  const dto = await adminRequest<RawMaterial>(
    `/v1/business/outlets/${outletId}/raw-materials/${rawMaterialId}`,
    { method: 'PUT', body: JSON.stringify(body) },
  )
  return toRawMaterialView(dto)
}

/**
 * Soft delete. ⚠️ Menghapus bahan baku **tidak** menghapus baris
 * `product_recipes` yang merujuknya — resep yatim tetap ada dan dilewati secara
 * diam-diam saat pemotongan stok ([03 §7.5] `[NEEDS DISCUSSION]`).
 */
export const deleteRawMaterial = (outletId: OutletId, rawMaterialId: string): Promise<null> =>
  adminRequest<null>(`/v1/business/outlets/${outletId}/raw-materials/${rawMaterialId}`, {
    method: 'DELETE',
  })

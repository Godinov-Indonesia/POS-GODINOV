/**
 * Endpoint restock, waste bahan baku, dan stock opname — docs/03 §8, §9, §10.
 *
 * ⚠️ PERBEDAAN PERILAKU YANG DISENGAJA DAN WAJIB TERCERMIN DI UI ([03 §9.1]):
 * waste sisi **Admin menolak** bila stok tidak mencukupi, sedangkan waste
 * produk dari **POS membolehkan stok minus**. Keduanya bukan bug.
 */

import { adminBulk, adminRequest, adminRequestList } from '@/lib/api/admin-client'
import { toMajor, toMinor } from '@/lib/money'
import type { OutletId } from '@/lib/types/api'
import type {
  OpnameInput,
  OpnameLogDto,
  OpnameLogView,
  RestockInput,
  RestockLogDto,
  RestockLogView,
  WasteInput,
  WasteLogDto,
} from '@/lib/types/inventory'

/* ── Restock ──────────────────────────────────────────────────────────────── */

const toRestockView = (dto: RestockLogDto): RestockLogView => ({
  id: dto.id,
  raw_material_id: dto.raw_material_id,
  quantity: dto.quantity,
  cost_per_unit_minor: toMinor(dto.cost_per_unit),
  total_cost_minor: toMinor(dto.total_cost),
  supplier_name: dto.supplier_name,
  created_at: dto.created_at,
})

/**
 * Efek samping: menambah stok **dan** menghitung ulang HPP sebagai moving
 * average — `(stok_lama × cost_lama + qty × cost_masuk) / (stok_lama + qty)`.
 */
export async function createRestock(
  outletId: OutletId,
  input: RestockInput,
): Promise<RestockLogView> {
  const dto = await adminRequest<RestockLogDto>(
    `/v1/business/outlets/${outletId}/raw-materials/${input.raw_material_id}/restock`,
    {
      method: 'POST',
      body: JSON.stringify({
        quantity: input.quantity,
        cost_per_unit: toMajor(input.cost_per_unit_minor),
        supplier_name: input.supplier_name,
      }),
    },
  )
  return toRestockView(dto)
}

/** All-or-nothing; seluruh bahan baku di-lock sekaligus. */
export async function createRestockBulk(
  outletId: OutletId,
  items: RestockInput[],
): Promise<RestockLogView[]> {
  const rows = await adminBulk<RestockLogDto>(
    `/v1/business/outlets/${outletId}/restock/bulk`,
    items.map((item) => ({
      raw_material_id: item.raw_material_id,
      quantity: item.quantity,
      cost_per_unit: toMajor(item.cost_per_unit_minor),
      supplier_name: item.supplier_name,
    })),
  )
  return rows.map(toRestockView)
}

/** ⚠️ Tanpa filter tanggal dan tanpa paginasi — mengembalikan SELURUH riwayat. */
export async function listRestockLogs(outletId: OutletId): Promise<RestockLogView[]> {
  const rows = await adminRequestList<RestockLogDto>(
    `/v1/business/outlets/${outletId}/reports/restock`,
  )
  return rows.map(toRestockView)
}

/* ── Waste bahan baku ─────────────────────────────────────────────────────── */

export const createWaste = (outletId: OutletId, input: WasteInput): Promise<WasteLogDto> =>
  adminRequest<WasteLogDto>(
    `/v1/business/outlets/${outletId}/raw-materials/${input.raw_material_id}/waste`,
    { method: 'POST', body: JSON.stringify({ quantity: input.quantity, reason: input.reason }) },
  )

export const createWasteBulk = (
  outletId: OutletId,
  items: WasteInput[],
): Promise<WasteLogDto[]> =>
  adminBulk<WasteLogDto>(`/v1/business/outlets/${outletId}/waste/bulk`, items)

export const listWasteLogs = (outletId: OutletId): Promise<WasteLogDto[]> =>
  adminRequestList<WasteLogDto>(`/v1/business/outlets/${outletId}/reports/waste`)

/* ── Stock Opname ─────────────────────────────────────────────────────────── */

const toOpnameView = (dto: OpnameLogDto): OpnameLogView => ({
  id: dto.id,
  raw_material_id: dto.raw_material_id,
  system_stock: dto.system_stock,
  actual_stock: dto.actual_stock,
  difference: dto.difference,
  fraud_flag: dto.fraud_flag,
  input_type: dto.input_type,
  system_package_quantity: dto.system_package_quantity,
  actual_package_quantity: dto.actual_package_quantity,
  difference_value_minor: toMinor(dto.difference_value),
  notes: dto.notes,
  created_at: dto.created_at,
})

/**
 * ⚠️ **Destruktif dan tidak dapat dibatalkan**: `raw_materials.stock` ditimpa
 * dengan `actual_stock`. Tidak ada endpoint pembatalan opname.
 */
export async function createOpname(
  outletId: OutletId,
  input: OpnameInput,
): Promise<OpnameLogView> {
  const dto = await adminRequest<OpnameLogDto>(
    `/v1/business/outlets/${outletId}/raw-materials/${input.raw_material_id}/opnames`,
    {
      method: 'POST',
      body: JSON.stringify({
        input_type: input.input_type,
        actual_stock: input.actual_stock,
        notes: input.notes,
      }),
    },
  )
  return toOpnameView(dto)
}

/** Bentuk yang paling berguna — opname biasanya dilakukan untuk seluruh gudang. */
export async function createOpnameBulk(
  outletId: OutletId,
  items: OpnameInput[],
): Promise<OpnameLogView[]> {
  const rows = await adminBulk<OpnameLogDto>(`/v1/business/outlets/${outletId}/opnames/bulk`, items)
  return rows.map(toOpnameView)
}

export async function listOpnameLogs(outletId: OutletId): Promise<OpnameLogView[]> {
  const rows = await adminRequestList<OpnameLogDto>(
    `/v1/business/outlets/${outletId}/reports/opnames`,
  )
  return rows.map(toOpnameView)
}

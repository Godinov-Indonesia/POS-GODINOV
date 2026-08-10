/**
 * DTO & model domain operasi inventori — docs/03 §8, §9, §10.
 *
 * Dipisahkan dari `lib/types/api.ts` supaya modul inventori (restock, waste,
 * opname) dapat dibaca sebagai satu kesatuan; ketiganya berbagi bentuk log yang
 * mirip dan selalu dibaca berdampingan di layar laporan.
 */

import type { IsoDateTime, OutletId } from '@/lib/types/api'

/* ── Restock ([03 §8]) ────────────────────────────────────────────────────── */

export type RestockLogDto = {
  id: string
  outlet_id: OutletId
  raw_material_id: string
  quantity: number
  cost_per_unit: number
  total_cost: number
  supplier_name: string
  /** ⚠️ Berisi **Business ID**, bukan Staff ID — endpoint hanya untuk Owner. */
  recorded_by: string
  created_at: IsoDateTime
}

export type RestockLogView = {
  id: string
  raw_material_id: string
  quantity: number
  cost_per_unit_minor: number
  total_cost_minor: number
  supplier_name: string
  created_at: IsoDateTime
}

export type RestockInput = {
  raw_material_id: string
  /** Harus > 0. Dalam base unit. */
  quantity: number
  /** Harus ≥ 0. Dalam **sen**. */
  cost_per_unit_minor: number
  supplier_name?: string
}

/* ── Waste bahan baku ([03 §9]) ───────────────────────────────────────────── */

export type WasteLogDto = {
  id: string
  outlet_id: OutletId
  raw_material_id: string
  quantity: number
  reason: string
  recorded_by: string
  created_at: IsoDateTime
}

export type WasteInput = {
  raw_material_id: string
  /** Harus > 0. */
  quantity: number
  /** **Wajib** diisi — backend menolak yang kosong. */
  reason: string
}

/* ── Stock Opname ([03 §10]) ──────────────────────────────────────────────── */

export type OpnameInputType = 'base_unit' | 'package_unit'

export type OpnameLogDto = {
  id: string
  outlet_id: OutletId
  raw_material_id: string
  system_stock: number
  actual_stock: number
  /** `actual − system` dalam base unit. Negatif = kekurangan. */
  difference: number
  /** `true` bila selisih > 5% dari stok sistem. Ambang hard-coded di backend. */
  fraud_flag: boolean
  input_type: OpnameInputType
  system_package_quantity: number | null
  actual_package_quantity: number | null
  /** Nilai selisih dalam **Rupiah** = `difference × cost_per_unit`. */
  difference_value: number
  notes: string
  recorded_by: string
  created_at: IsoDateTime
}

export type OpnameLogView = Omit<OpnameLogDto, 'difference_value' | 'outlet_id' | 'recorded_by'> & {
  /** Nilai selisih dalam **sen**. */
  difference_value_minor: number
}

export type OpnameInput = {
  raw_material_id: string
  input_type: OpnameInputType
  /** Harus ≥ 0. Diinterpretasikan sesuai `input_type`. */
  actual_stock: number
  notes?: string
}

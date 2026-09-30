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

/* ── Form Stock Opname Terkelola (SO V2) ─────────────────────────────────── */

export type SOStatus = 'OPEN' | 'PUBLISHED' | 'COUNTING' | 'CLOSED' | 'APPROVED' | 'REJECTED'
export type SOScope = 'FULL' | 'CATEGORY' | 'PARTIAL'

export type CreateSOFormInput = {
  scope: SOScope
  notes?: string
  raw_material_ids: string[]
}

export type SOFormMaterialDto = {
  raw_material_id: string
  raw_material_name: string
  unit: string
  package_unit: string | null
  quantity_per_package: number | null
}

export type SOCountProgress = {
  total_materials: number
  counted_materials: number
  counters: string[]
}

export type SOFormResponse = {
  id: string
  outlet_id: string
  status: SOStatus
  scope: SOScope
  notes: string
  created_by: string
  recount_of: string | null
  recount_number: number
  published_at: IsoDateTime | null
  closed_at: IsoDateTime | null
  created_at: IsoDateTime
  materials?: SOFormMaterialDto[]
  count_progress?: SOCountProgress
}

// ⚠️ READ-ONLY DTO untuk Dashboard Bisnis (Audit hitungan staf lapangan via SO Mobile)
export type SOCountSheetItem = {
  raw_material_id: string
  raw_material_name: string
  unit: string
  actual_packages: number
  actual_loose: number
  actual_stock: number
  notes: string
}

export type SOCountSheet = {
  counted_by: string
  staff_name: string
  items: SOCountSheetItem[]
}

export type SOFinalSheetItem = {
  raw_material_id: string
  raw_material_name: string
  unit: string
  actual_packages: number
  actual_loose: number
  actual_stock: number
  system_packages: number | null
  system_loose: number | null
  system_stock: number
  difference: number
  difference_value: number
  fraud_flag: boolean
}

export type SOFinalSummary = {
  total_items: number
  matched_items: number
  different_items: number
  fraud_flagged_items: number
  total_difference_value: number
}

export type SOHistoryEntry = {
  id: string
  recount_number: number
  status: SOStatus
  created_at: IsoDateTime
  closed_at: IsoDateTime | null
  label: string
}

export type SOClosedResponse = Omit<SOFormResponse, 'materials' | 'count_progress'> & {
  count_sheets: SOCountSheet[]
  final_sheet: {
    summary: SOFinalSummary
    items: SOFinalSheetItem[]
  }
  history?: SOHistoryEntry[]
}

export type SOApproveResult = {
  session_id: string
  status: SOStatus
  items_adjusted: number
}


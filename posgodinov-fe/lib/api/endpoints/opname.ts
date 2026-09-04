/**
 * Endpoint modul Opname — **butir 3** ([11 §4.5], [11 §4.6]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DUA TIPE RESPONS, DAN PERBEDAANNYA MENGIKAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `OpnameDraftResponse`  — SETIAP endpoint selama status DRAFT
 *   `OpnameLockResponse`   — HANYA respons `POST /lock`
 *
 * Keduanya adalah tipe yang berbeda, bukan satu tipe dengan field opsional.
 * Field opsional akan membuat `result.system_stock` dapat ditulis di layar mana
 * pun dan sekadar bernilai `undefined` saat DRAFT — dan `undefined` yang
 * dirender menjadi "—" terlihat seperti fitur yang belum jadi, bukan seperti
 * kesalahan. Tipe terpisah membuat kekeliruan itu gagal saat kompilasi.
 */

import { opnameRequest } from '@/lib/api/opname-client'
import type { OpnameInputType, OpnameScope, OpnameStatus } from '@/lib/db/opname-models'
import type { IsoDateTime } from '@/lib/types/api'

/* ── Bentuk kawat ─────────────────────────────────────────────────────────── */

/**
 * Satu baris pada fase DRAFT.
 *
 * ⛔ Perhatikan apa yang TIDAK ada: `system_stock`, `difference`,
 * `difference_value`, `fraud_flag`. Server pun tidak mengirimkannya — struct
 * `OpnameItemDraftDTO` di Go secara harfiah tidak memiliki field itu.
 */
export type OpnameDraftItemDto = {
  raw_material_id: string
  raw_material_name: string
  unit: string
  package_unit: string | null
  quantity_per_package: number | null
  actual_stock: number
  actual_package_quantity: number | null
  input_type: OpnameInputType
  notes: string
}

export type OpnameDraftDto = {
  id: string
  status: OpnameStatus
  scope: OpnameScope
  items_counted: number
  items: OpnameDraftItemDto[] | null
}

/** Satu baris pada fase LOCKED — satu-satunya bentuk yang memuat ekspektasi. */
export type OpnameLockedItemDto = OpnameDraftItemDto & {
  system_stock: number
  system_package_quantity: number | null
  difference: number
  difference_value: number
  fraud_flag: boolean
}

export type OpnameLockDto = {
  status: OpnameStatus
  locked_at: IsoDateTime
  summary: {
    items_counted: number
    items_with_variance: number
    total_variance_value: number
  }
  items: OpnameLockedItemDto[] | null
}

export type OpnameSessionDto = {
  id: string
  status: OpnameStatus
  scope: OpnameScope
  notes: string
  counted_by: string
  locked_at: IsoDateTime | null
  approved_at: IsoDateTime | null
  client_created_at: IsoDateTime
}

/* ── Panggilan ────────────────────────────────────────────────────────────── */

export const createOpnameSession = (payload: {
  id: string
  scope: OpnameScope
  notes: string
  client_created_at: IsoDateTime
}): Promise<OpnameSessionDto> =>
  opnameRequest<OpnameSessionDto>('/v1/opname/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchOpnameDraft = (sessionId: string): Promise<OpnameDraftDto> =>
  opnameRequest<OpnameDraftDto>(`/v1/opname/sessions/${sessionId}`)

/**
 * Mengirim hitungan fisik. Responsnya **tidak pernah** memuat ekspektasi.
 *
 * Seluruh baris dikirim sekaligus, bukan satu per satu: opname penuh menyentuh
 * ratusan bahan, dan permintaan per baris pada jaringan gudang yang buruk
 * berarti ratusan kesempatan gagal di tengah.
 */
export const pushOpnameItems = (
  sessionId: string,
  items: {
    raw_material_id: string
    actual_stock: number
    actual_package_quantity: number | null
    input_type: OpnameInputType
    notes: string
  }[],
): Promise<OpnameDraftDto> =>
  opnameRequest<OpnameDraftDto>(`/v1/opname/sessions/${sessionId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })

/**
 * Mengunci sesi — **titik tak dapat dibatalkan**.
 *
 * `{ confirm: true }` diwajibkan server. Penguncian tidak dapat dibatalkan, dan
 * permintaan POST tanpa body terlalu mudah terkirim karena salah ketuk.
 *
 * Ini SATU-SATUNYA panggilan di berkas ini yang mengembalikan angka sistem.
 */
export const lockOpnameSession = (sessionId: string): Promise<OpnameLockDto> =>
  opnameRequest<OpnameLockDto>(`/v1/opname/sessions/${sessionId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  })

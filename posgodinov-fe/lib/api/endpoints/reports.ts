/**
 * Endpoint laporan — docs/03 §11.
 *
 * ⚠️ DUA BATASAN YANG MEMBENTUK SELURUH UI LAPORAN:
 *
 * 1. **Tidak ada paginasi.** `/reports/transactions` mengembalikan setiap
 *    transaksi dalam rentang beserta seluruh item-nya; outlet sibuk dengan
 *    rentang sebulan dapat menghasilkan payload puluhan megabita. Karena itu
 *    `start_date`/`end_date` **selalu** dikirim dan UI membatasinya 7 hari
 *    ([05 §1.8.3]).
 * 2. **Filter memakai `created_at`** (waktu tiba di server), bukan
 *    `client_created_at` (waktu transaksi sesungguhnya). Pada sistem
 *    offline-first ini berdampak nyata: penjualan Senin yang baru tersinkron
 *    Rabu tercatat sebagai pendapatan Rabu. Setiap layar laporan **wajib**
 *    menampilkan banner yang menyatakan hal ini.
 */

import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import { toMinor } from '@/lib/money'
import type { IsoDateTime, OutletId, PosTransaction, TransactionStatus } from '@/lib/types/api'
import type { DateRange } from '@/lib/time'

const rangeQuery = (range: DateRange): string =>
  `?start_date=${encodeURIComponent(range.start)}&end_date=${encodeURIComponent(range.end)}`

export type DashboardDto = {
  stats: {
    total_revenue: number
    total_transactions: number
    /** Jumlah **item produk** dari waste kasir — bukan Rupiah, dan tidak mencakup waste bahan baku. */
    total_wastes: number
    /** `SUM(discrepancy)` dari shift CLOSED — selisih kas laci. */
    total_discrepancy: number
  } | null
  /** Top 5, limit hard-coded di backend. Bisa `null` ([05 §3.1]). */
  top_products: { product_id: string; product_name: string; quantity_sold: number }[] | null
}

export type DashboardView = {
  totalRevenueMinor: number
  totalTransactions: number
  totalWasteItems: number
  totalDiscrepancyMinor: number
  topProducts: { product_id: string; product_name: string; quantity_sold: number }[]
}

export async function getDashboard(
  outletId: OutletId,
  range: DateRange,
): Promise<DashboardView> {
  const dto = await adminRequest<DashboardDto | null>(
    `/v1/business/outlets/${outletId}/reports/dashboard${rangeQuery(range)}`,
  )

  // Outlet milik tenant lain menghasilkan statistik nol, bukan 403 ([03 §11.1]).
  return {
    totalRevenueMinor: toMinor(dto?.stats?.total_revenue ?? 0),
    totalTransactions: dto?.stats?.total_transactions ?? 0,
    totalWasteItems: dto?.stats?.total_wastes ?? 0,
    totalDiscrepancyMinor: toMinor(dto?.stats?.total_discrepancy ?? 0),
    topProducts: dto?.top_products ?? [],
  }
}

export type TransactionReportRow = {
  id: string
  customer_name: string
  total_amount_minor: number
  payment_method: string
  /** `VOIDED` (v2) dan `CANCELLED` (warisan v1) sama-sama muncul ([11 §2.1]). */
  status: TransactionStatus
  cancel_notes: string
  /** Waktu transaksi sesungguhnya di perangkat. */
  client_created_at: string
  /** Waktu tiba di server — kolom yang dipakai filter rentang tanggal. */
  created_at: string
  items: { id: string; product_id: string; quantity: number; unit_price_minor: number }[]
}

/** Mencakup transaksi `COMPLETED` **dan** `CANCELLED`. Diurutkan `created_at DESC`. */
export async function listTransactionReport(
  outletId: OutletId,
  range: DateRange,
): Promise<TransactionReportRow[]> {
  const rows = await adminRequestList<PosTransaction>(
    `/v1/business/outlets/${outletId}/reports/transactions${rangeQuery(range)}`,
  )

  return rows.map((row) => ({
    id: row.id,
    customer_name: row.customer_name,
    total_amount_minor: toMinor(row.total_amount),
    payment_method: row.payment_method,
    status: row.status,
    cancel_notes: row.cancel_notes,
    client_created_at: row.client_created_at,
    created_at: row.created_at,
    // Item tidak menyertakan nama produk — hanya `product_id`. Penggabungan
    // dengan katalog dilakukan di komponen ([03 §11.2]).
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_minor: toMinor(item.unit_price),
    })),
  }))
}

/* ── Rekonsiliasi shift — butir 9 ([11 §M15.3]) ───────────────────────────── */

/**
 * Bentuk kawat satu baris rekonsiliasi.
 *
 * ⚠️ Endpoint ini adalah **satu-satunya** tempat `expected_*` dan `*_variance`
 * meninggalkan server, dan ia berada di bawah token Business — bukan device
 * token. Aturan R3 melarang angka ini mencapai perangkat kasir; memanggilnya
 * dari bundle POS akan melanggar batas itu, dan `no-restricted-imports` pada
 * `features/admin/**` maupun sebaliknya menjaga keduanya tetap terpisah.
 *
 * Seluruh nominal masih **Rupiah desimal** — konversi ke sen terjadi di bawah.
 */
type ShiftReconciliationDto = {
  shift_id: string
  staff_id: string
  staff_name: string
  device_id: string
  status: string
  opening_balance: number
  declared_cash: number
  declared_edc_total: number
  declared_qris_total: number
  blind_close: boolean
  expected_cash: number | null
  expected_edc_total: number | null
  expected_qris_total: number | null
  cash_variance: number | null
  edc_variance: number | null
  qris_variance: number | null
  flagged: boolean
  variance_threshold: number
  client_opened_at: IsoDateTime
  client_closed_at: IsoDateTime | null
  reconciled_at: IsoDateTime | null
}

export type ShiftReconciliationView = {
  shiftId: string
  staffName: string
  deviceId: string
  status: string
  openingBalanceMinor: number
  declaredCashMinor: number
  declaredEdcMinor: number
  declaredQrisMinor: number
  blindClose: boolean
  /** `null` = shift belum direkonsiliasi server. **Bukan** berarti nol. */
  expectedCashMinor: number | null
  expectedEdcMinor: number | null
  expectedQrisMinor: number | null
  cashVarianceMinor: number | null
  edcVarianceMinor: number | null
  qrisVarianceMinor: number | null
  flagged: boolean
  varianceThresholdMinor: number
  openedAt: IsoDateTime
  closedAt: IsoDateTime | null
  reconciledAt: IsoDateTime | null
}

/**
 * `toMinor` yang mempertahankan `null`.
 *
 * `toMinor(null as never)` menghasilkan `0`, dan nol pada kolom ekspektasi
 * berarti "shift ini pas" — kebalikan dari "shift ini belum dihitung". Layar
 * pemilik harus dapat membedakan keduanya.
 */
const toMinorOrNull = (value: number | null): number | null =>
  value === null ? null : toMinor(value)

export const listShiftReconciliation = async (
  outletId: OutletId,
  range: DateRange,
): Promise<ShiftReconciliationView[]> => {
  const rows = await adminRequestList<ShiftReconciliationDto>(
    `/v1/business/outlets/${outletId}/reports/shift-reconciliation${rangeQuery(range)}`,
  )

  return rows.map((r) => ({
    shiftId: r.shift_id,
    staffName: r.staff_name,
    deviceId: r.device_id,
    status: r.status,
    openingBalanceMinor: toMinor(r.opening_balance),
    declaredCashMinor: toMinor(r.declared_cash),
    declaredEdcMinor: toMinor(r.declared_edc_total),
    declaredQrisMinor: toMinor(r.declared_qris_total),
    blindClose: r.blind_close,
    expectedCashMinor: toMinorOrNull(r.expected_cash),
    expectedEdcMinor: toMinorOrNull(r.expected_edc_total),
    expectedQrisMinor: toMinorOrNull(r.expected_qris_total),
    cashVarianceMinor: toMinorOrNull(r.cash_variance),
    edcVarianceMinor: toMinorOrNull(r.edc_variance),
    qrisVarianceMinor: toMinorOrNull(r.qris_variance),
    flagged: r.flagged,
    varianceThresholdMinor: toMinor(r.variance_threshold),
    openedAt: r.client_opened_at,
    closedAt: r.client_closed_at,
    reconciledAt: r.reconciled_at,
  }))
}

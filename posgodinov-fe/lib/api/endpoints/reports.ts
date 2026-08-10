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
import type { OutletId, PosTransaction } from '@/lib/types/api'
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
  status: 'COMPLETED' | 'CANCELLED'
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

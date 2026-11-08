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

// ── Rincian Mendalam Shift (Shift Detail) ───────────────────────────────────

export type ShiftDetailDto = {
  shift_summary: {
    shift_id: string
    outlet_id: string
    staff_id: string
    staff_name: string
    device_id: string
    status: string
    blind_close: boolean
    opened_at: IsoDateTime
    closed_at: IsoDateTime | null
    reconciled_at: IsoDateTime | null
    opening_balance: number
    cash: { declared: number; expected: number | null; variance: number | null }
    edc: { declared: number; expected: number | null; variance: number | null }
    qris: { declared: number; expected: number | null; variance: number | null }
    flagged: boolean
    variance_threshold: number
  }
  transactions_metric: {
    total_count: number
    completed_count: number
    voided_count: number
    total_gross_amount: number
    total_discount_amount: number
    total_net_amount: number
    payment_breakdown: Record<string, number>
    transactions: {
      id: string
      receipt_code: string
      customer_name: string
      total_amount: number
      payment_method: string
      status: string
      reprint_count: number
      receipt_printed_at: IsoDateTime | null
      created_at: IsoDateTime
      items: {
        id: string
        product_id: string
        product_name: string
        sku: string
        quantity: number
        unit_price: number
        subtotal: number
      }[]
    }[]
  }
  receipt_prints_metric: {
    total_reprinted: number
    transactions_reprinted: {
      transaction_id: string
      receipt_code: string
      reprint_count: number
      receipt_printed_at: IsoDateTime | null
    }[]
  }
  voids_metric: {
    total_count: number
    total_value_amount: number
    items: {
      id: string
      scope: string
      product_id: string | null
      product_name: string
      quantity_before: number
      quantity_after: number
      value_amount: number
      reason_code: string
      reason_notes: string
      staff_name: string
      authorized_by_name: string
      created_at: IsoDateTime
    }[]
  }
  wastes_metric: {
    total_count: number
    items: {
      id: string
      item_id: string
      item_name: string
      waste_type: 'PRODUCT' | 'RAW_MATERIAL'
      quantity: number
      unit: string
      reason: string
      reason_code: string
      recorded_by_name: string
      created_at: IsoDateTime
    }[]
  }
  returns_metric: {
    total_count: number
    total_refund_amount: number
    items: {
      id: string
      transaction_id: string
      refund_amount: number
      refund_method: string
      reason: string
      created_at: IsoDateTime
    }[]
  }
  security_events: {
    id: string
    event_type: string
    severity: string
    details?: Record<string, unknown>
    created_at: IsoDateTime
  }[]
}

export type ShiftDetailView = {
  summary: {
    shiftId: string
    outletId: string
    staffId: string
    staffName: string
    deviceId: string
    status: string
    blindClose: boolean
    openedAt: IsoDateTime
    closedAt: IsoDateTime | null
    reconciledAt: IsoDateTime | null
    openingBalanceMinor: number
    cash: { declaredMinor: number; expectedMinor: number | null; varianceMinor: number | null }
    edc: { declaredMinor: number; expectedMinor: number | null; varianceMinor: number | null }
    qris: { declaredMinor: number; expectedMinor: number | null; varianceMinor: number | null }
    flagged: boolean
    varianceThresholdMinor: number
  }
  transactions: {
    totalCount: number
    completedCount: number
    voidedCount: number
    totalGrossMinor: number
    totalNetMinor: number
    paymentBreakdownMinor: Record<string, number>
    list: {
      id: string
      receiptCode: string
      customerName: string
      totalAmountMinor: number
      paymentMethod: string
      status: string
      reprintCount: number
      receiptPrintedAt: IsoDateTime | null
      createdAt: IsoDateTime
      items: {
        id: string
        productId: string
        productName: string
        sku: string
        quantity: number
        unitPriceMinor: number
        subtotalMinor: number
      }[]
    }[]
  }
  receiptPrints: {
    totalReprinted: number
    list: {
      transactionId: string
      receiptCode: string
      reprintCount: number
      receiptPrintedAt: IsoDateTime | null
    }[]
  }
  voids: {
    totalCount: number
    totalValueMinor: number
    list: {
      id: string
      scope: string
      productId: string | null
      productName: string
      quantityBefore: number
      quantityAfter: number
      valueAmountMinor: number
      reasonCode: string
      reasonNotes: string
      staffName: string
      authorizedByName: string
      createdAt: IsoDateTime
    }[]
  }
  wastes: {
    totalCount: number
    list: {
      id: string
      itemId: string
      itemName: string
      wasteType: 'PRODUCT' | 'RAW_MATERIAL'
      quantity: number
      unit: string
      reason: string
      reasonCode: string
      recordedByName: string
      createdAt: IsoDateTime
    }[]
  }
  returns: {
    totalCount: number
    totalRefundMinor: number
    list: {
      id: string
      transactionId: string
      refundAmountMinor: number
      refundMethod: string
      reason: string
      createdAt: IsoDateTime
    }[]
  }
  securityEvents: {
    id: string
    eventType: string
    severity: string
    details?: Record<string, unknown>
    createdAt: IsoDateTime
  }[]
}

export async function getShiftDetail(outletId: OutletId, shiftId: string): Promise<ShiftDetailView> {
  const dto = await adminRequest<ShiftDetailDto>(
    `/v1/business/outlets/${outletId}/reports/shift-reconciliation/${shiftId}`,
  )

  const paymentBreakdownMinor: Record<string, number> = {}
  if (dto.transactions_metric.payment_breakdown) {
    for (const [method, amount] of Object.entries(dto.transactions_metric.payment_breakdown)) {
      paymentBreakdownMinor[method] = toMinor(amount)
    }
  }

  return {
    summary: {
      shiftId: dto.shift_summary.shift_id,
      outletId: dto.shift_summary.outlet_id,
      staffId: dto.shift_summary.staff_id,
      staffName: dto.shift_summary.staff_name,
      deviceId: dto.shift_summary.device_id,
      status: dto.shift_summary.status,
      blindClose: dto.shift_summary.blind_close,
      openedAt: dto.shift_summary.opened_at,
      closedAt: dto.shift_summary.closed_at,
      reconciledAt: dto.shift_summary.reconciled_at,
      openingBalanceMinor: toMinor(dto.shift_summary.opening_balance),
      cash: {
        declaredMinor: toMinor(dto.shift_summary.cash.declared),
        expectedMinor: toMinorOrNull(dto.shift_summary.cash.expected),
        varianceMinor: toMinorOrNull(dto.shift_summary.cash.variance),
      },
      edc: {
        declaredMinor: toMinor(dto.shift_summary.edc.declared),
        expectedMinor: toMinorOrNull(dto.shift_summary.edc.expected),
        varianceMinor: toMinorOrNull(dto.shift_summary.edc.variance),
      },
      qris: {
        declaredMinor: toMinor(dto.shift_summary.qris.declared),
        expectedMinor: toMinorOrNull(dto.shift_summary.qris.expected),
        varianceMinor: toMinorOrNull(dto.shift_summary.qris.variance),
      },
      flagged: dto.shift_summary.flagged,
      varianceThresholdMinor: toMinor(dto.shift_summary.variance_threshold),
    },
    transactions: {
      totalCount: dto.transactions_metric.total_count,
      completedCount: dto.transactions_metric.completed_count,
      voidedCount: dto.transactions_metric.voided_count,
      totalGrossMinor: toMinor(dto.transactions_metric.total_gross_amount),
      totalNetMinor: toMinor(dto.transactions_metric.total_net_amount),
      paymentBreakdownMinor,
      list: (dto.transactions_metric.transactions ?? []).map((t) => ({
        id: t.id,
        receiptCode: t.receipt_code,
        customerName: t.customer_name,
        totalAmountMinor: toMinor(t.total_amount),
        paymentMethod: t.payment_method,
        status: t.status,
        reprintCount: t.reprint_count,
        receiptPrintedAt: t.receipt_printed_at,
        createdAt: t.created_at,
        items: (t.items ?? []).map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceMinor: toMinor(item.unit_price),
          subtotalMinor: toMinor(item.subtotal),
        })),
      })),
    },
    receiptPrints: {
      totalReprinted: dto.receipt_prints_metric.total_reprinted,
      list: (dto.receipt_prints_metric.transactions_reprinted ?? []).map((rp) => ({
        transactionId: rp.transaction_id,
        receiptCode: rp.receipt_code,
        reprintCount: rp.reprint_count,
        receiptPrintedAt: rp.receipt_printed_at,
      })),
    },
    voids: {
      totalCount: dto.voids_metric.total_count,
      totalValueMinor: toMinor(dto.voids_metric.total_value_amount),
      list: (dto.voids_metric.items ?? []).map((v) => ({
        id: v.id,
        scope: v.scope,
        productId: v.product_id,
        productName: v.product_name,
        quantityBefore: v.quantity_before,
        quantityAfter: v.quantity_after,
        valueAmountMinor: toMinor(v.value_amount),
        reasonCode: v.reason_code,
        reasonNotes: v.reason_notes,
        staffName: v.staff_name,
        authorizedByName: v.authorized_by_name,
        createdAt: v.created_at,
      })),
    },
    wastes: {
      totalCount: dto.wastes_metric.total_count,
      list: (dto.wastes_metric.items ?? []).map((w) => ({
        id: w.id,
        itemId: w.item_id,
        itemName: w.item_name,
        wasteType: w.waste_type,
        quantity: w.quantity,
        unit: w.unit,
        reason: w.reason,
        reasonCode: w.reason_code,
        recordedByName: w.recorded_by_name,
        createdAt: w.created_at,
      })),
    },
    returns: {
      totalCount: dto.returns_metric.total_count,
      totalRefundMinor: toMinor(dto.returns_metric.total_refund_amount),
      list: (dto.returns_metric.items ?? []).map((r) => ({
        id: r.id,
        transactionId: r.transaction_id,
        refundAmountMinor: toMinor(r.refund_amount),
        refundMethod: r.refund_method,
        reason: r.reason,
        createdAt: r.created_at,
      })),
    },
    securityEvents: (dto.security_events ?? []).map((se) => ({
      id: se.id,
      eventType: se.event_type,
      severity: se.severity,
      details: se.details,
      createdAt: se.created_at,
    })),
  }
}

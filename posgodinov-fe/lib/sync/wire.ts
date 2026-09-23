/**
 * Konversi baris lokal → payload kawat — docs/05 §1.6.3 & §3.3.
 *
 * Jaring pengaman terakhir sebelum data meninggalkan perangkat. Tiga hal yang
 * terjadi di sini dan tidak boleh terjadi di tempat lain:
 * 1. **Membuang metadata lokal** (seluruh field berprefiks `_`).
 * 2. **Mengonversi sen → Rupiah desimal** (ADR-05).
 * 3. **Memvalidasi `payment_method`** — melempar bila ada nilai tak sah yang
 *    lolos. Lebih baik sinkronisasi gagal keras daripada mencemari laporan
 *    selamanya; tidak ada endpoint untuk memperbaiki data lama.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * v2 (M11.4) — DUA JALUR BERDAMPINGAN, BUKAN SATU YANG DIUBAH
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `toWireShift` dan `toWireTransaction` **tetap memancarkan bentuk v1 persis
 * seperti sebelumnya**. Varian `…V2` berdiri di sebelahnya dan baru dipakai
 * setelah M12 memasang header `X-POS-Contract-Version: 2` pada mesin sync.
 *
 * Alasannya adalah gerbang M11 itu sendiri: fase ini wajib menyelesaikan bentuk
 * data **tanpa mengubah satu pun perilaku yang terlihat**, termasuk bentuk byte
 * yang keluar ke jaringan. Menyunting mapper v1 di tempat akan membuat kegagalan
 * M11 dan kegagalan M12 mustahil dibedakan saat rilis percontohan.
 *
 * Pembagian ini mencerminkan `decodeV1`/`decodeV2` di sisi Go ([11 §4.1]).
 */

import {
  isCardMethod,
  paymentMethodSchema,
  paymentSummaryMethodSchema,
} from '@/lib/constants/payment'
import type {
  LocalPayment,
  LocalReturn,
  LocalSecurityEvent,
  LocalShift,
  LocalTransaction,
  LocalVoidLog,
  LocalWaste,
} from '@/lib/db/models'
import { toMajor } from '@/lib/money'
import type {
  PaymentPayload,
  ReturnPayload,
  SecurityEventPayload,
  ShiftPayload,
  ShiftPayloadV2,
  TransactionPayload,
  TransactionPayloadV2,
  VoidLogPayload,
  WastePayload,
  WastePayloadV2,
} from '@/lib/types/api'

export const toWireShift = (shift: LocalShift): ShiftPayload => {
  return {
    id: shift.id,
    staff_id: shift.staff_id,
    opening_balance: toMajor(shift.opening_balance),
    closing_balance: toMajor(shift.closing_balance),
    expected_balance: toMajor(shift.expected_balance),
    discrepancy: toMajor(shift.discrepancy),
    status: shift.status,
    client_opened_at: shift.client_opened_at,
    client_closed_at: shift.client_closed_at,
  } as ShiftPayload
}

export const toWireTransaction = (transaction: LocalTransaction): TransactionPayload => {
  // Melempar bila entah bagaimana ada nilai tak sah yang lolos ke Dexie.
  paymentSummaryMethodSchema.parse(transaction.payment_method)

  return {
    id: transaction.id,
    shift_id: transaction.shift_id,
    customer_name: transaction.customer_name || "",
    total_amount: toMajor(transaction.total_amount),
    payment_method: transaction.payment_method,
    status: transaction.status,
    cancel_notes: transaction.cancel_notes || "",
    client_created_at: transaction.client_created_at,
    items: transaction.items.map((item) => ({
      id: item.id,
      transaction_id: transaction.id,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: toMajor(item.unit_price),
    })),
  } as TransactionPayload
}

/**
 * ⚠️ Daftar putih **eksplisit**, bukan `stripLocal()` mekanis seperti pada v1.
 *
 * Pembuangan berbasis prefiks `_` hanya menyaring metadata lokal. Migrasi Dexie
 * v4 menambahkan `reason_code`, `receipt_printed`, dan `printed_at` — field v2
 * tanpa prefiks — ke **setiap** baris waste lama, sehingga mapper mekanis akan
 * ikut memancarkannya pada payload v1. Kontrak v1 harus tetap berbentuk sama
 * persis sampai M12 menaikkan versinya secara sadar ([11 §4.1]).
 */
export const toWireWaste = (waste: LocalWaste): WastePayload => ({
  id: waste.id,
  staff_id: waste.staff_id,
  product_id: waste.product_id,
  quantity: Number(waste.quantity),
  reason: waste.reason,
  client_created_at: waste.client_created_at,
})

/* ══════════════════════ v2 — kontrak sync versi 2 ([11 §4.2]) ══════════════ */

/**
 * Invarian tender yang **wajib** dipenuhi sebelum payload meninggalkan perangkat.
 *
 * Server menolak ketidakcocokan dengan `422 TENDER_MISMATCH` dan baris masuk
 * karantina ([11 §3.4]). Memeriksanya di sini mengubah kegagalan senyap yang
 * baru ketahuan berjam-jam kemudian menjadi lemparan di tempat, dengan angka
 * yang menjelaskan dirinya sendiri.
 */
export function assertTenderIntegrity(
  transaction: LocalTransaction,
  payments: readonly LocalPayment[],
): void {
  const sum = payments.reduce((total, payment) => total + payment.amount, 0)
  if (sum !== transaction.total_amount) {
    throw new Error(
      `Tender tidak seimbang pada transaksi ${transaction.id}: ` +
        `Σ payments = ${sum} sen, total_amount = ${transaction.total_amount} sen.`,
    )
  }

  for (const payment of payments) {
    paymentMethodSchema.parse(payment.method)

    // Cerminan `CHECK ck_card_requires_trace` (butir 8). Ditegakkan di tiga
    // lapis — layar, berkas ini, dan basis data — karena lapisan UI saja dapat
    // dilewati perangkat yang dimodifikasi.
    if (isCardMethod(payment.method)) {
      if (!payment.trace_number?.trim()) {
        throw new Error(`Tender kartu tanpa trace_number pada transaksi ${transaction.id}.`)
      }
      if (!/^[0-9]{4}$/.test(payment.card_last4 ?? '')) {
        throw new Error(
          `Tender kartu tanpa 4 digit akhir yang sah pada transaksi ${transaction.id}.`,
        )
      }
    }
  }
}

/**
 * Rincian tender sebuah transaksi, dengan sintesis untuk baris warisan.
 *
 * Transaksi yang lahir sebelum M17.2 memasang penulis multi-tender hanya
 * memiliki `payment_method`. Merekonstruksi satu baris tender di sini menjaga
 * invarian `Σ payments = total_amount` berlaku untuk **setiap** baris,
 * berapa pun umurnya — sehingga sisi server tidak perlu mengenal dua bentuk.
 */
export function resolvePayments(transaction: LocalTransaction): LocalPayment[] {
  if (transaction.payments?.length) return transaction.payments

  if (transaction.payment_method === 'SPLIT') {
    // Tidak dapat direkonstruksi: `SPLIT` menyatakan ada dua tender atau lebih,
    // dan tidak ada satu pun informasi tersisa tentang pembagiannya. Mengarang
    // pembagian berarti memalsukan bukti audit; lebih baik gagal keras.
    throw new Error(
      `Transaksi ${transaction.id} berstatus SPLIT tanpa rincian tender — tidak dapat disintesis.`,
    )
  }

  return [
    {
      // UUID transaksi dipakai ulang sebagai UUID tender — **deterministik dan
      // disengaja**. Membangkitkan UUID baru pada setiap pengiriman akan
      // membuat percobaan ulang menyisipkan baris tender ganda di server;
      // `ON CONFLICT (id)` hanya melindungi bila id-nya stabil (aturan R2).
      // Tabelnya berbeda, jadi tidak ada tabrakan kunci.
      id: transaction.id,
      sequence: 1,
      method: transaction.payment_method,
      amount: transaction.total_amount,
    },
  ]
}

export const toWirePayment = (payment: LocalPayment): PaymentPayload => {
  paymentMethodSchema.parse(payment.method)

  return {
    id: payment.id,
    sequence: payment.sequence,
    method: payment.method,
    amount: toMajor(payment.amount),
    ...(payment.trace_number ? { trace_number: payment.trace_number } : {}),
    ...(payment.card_last4 ? { card_last4: payment.card_last4 } : {}),
    ...(payment.card_network ? { card_network: payment.card_network } : {}),
    ...(payment.approval_code ? { approval_code: payment.approval_code } : {}),
    ...(payment.edc_terminal_id ? { edc_terminal_id: payment.edc_terminal_id } : {}),
  }
}

/**
 * Shift pada kontrak v2.
 *
 * ⚠️ `expected_balance` dan `discrepancy` **tetap dikirim** demi kompatibilitas
 * v1, tetapi server **mengabaikannya** dan menghitung ulang ([11 §1] aturan R4).
 * Klien yang dimodifikasi tidak boleh menentukan selisih kasnya sendiri.
 */
export const toWireShiftV2 = (shift: LocalShift, deviceId: string): ShiftPayloadV2 => ({
  ...toWireShift(shift),
  device_id: shift.device_id ?? deviceId,
  master_data_version: shift.master_data_version ?? null,
  declared_cash: toMajor(shift.declared_cash ?? shift.closing_balance),
  declared_edc_total: toMajor(shift.declared_edc_total ?? 0),
  declared_qris_total: toMajor(shift.declared_qris_total ?? 0),
  blind_close: shift.blind_close ?? false,
  closed_by: shift.closed_by ?? null,
})

export function toWireTransactionV2(
  transaction: LocalTransaction,
  deviceId: string,
): TransactionPayloadV2 {
  const payments = resolvePayments(transaction)
  assertTenderIntegrity(transaction, payments)

  return {
    ...toWireTransaction(transaction),
    device_id: transaction.device_id ?? deviceId,
    short_code: transaction.short_code ?? null,
    receipt_printed_at: transaction.receipt_printed_at ?? null,
    reprint_count: transaction.reprint_count ?? 0,
    payment_method: transaction.payment_method,
    payments: payments.map(toWirePayment),
    voided_at: transaction.voided_at ?? null,
    voided_by: transaction.voided_by ?? null,
    void_reason_code: transaction.void_reason_code ?? null,
  }
}

export const toWireReturn = (ret: LocalReturn, deviceId: string): ReturnPayload => ({
  id: ret.id,
  original_transaction_id: ret.original_transaction_id,
  shift_id: ret.shift_id,
  device_id: ret.device_id ?? deviceId,
  staff_id: ret.staff_id,
  authorized_by: ret.authorized_by ?? null,
  return_type: ret.return_type,
  refund_method: ret.refund_method,
  refund_amount: toMajor(ret.refund_amount),
  reason_code: ret.reason_code,
  reason_notes: ret.reason_notes || '',
  receipt_printed: ret.receipt_printed,
  short_code: ret.short_code ?? null,
  client_created_at: ret.client_created_at,
  items: ret.items.map((item) => ({
    id: item.id,
    transaction_item_id: item.transaction_item_id,
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_price: toMajor(item.unit_price),
    restock: item.restock,
    // `_product_name` sengaja tidak ikut — kolomnya tidak ada di server, ia
    // hanya salinan lokal untuk struk dan riwayat.
    ...(item.waste_reason_code ? { waste_reason_code: item.waste_reason_code } : {}),
  })),
})

export const toWireVoidLog = (log: LocalVoidLog, deviceId: string): VoidLogPayload => ({
  id: log.id,
  shift_id: log.shift_id,
  device_id: log.device_id ?? deviceId,
  staff_id: log.staff_id,
  authorized_by: log.authorized_by ?? null,
  scope: log.scope,
  transaction_id: log.transaction_id ?? null,
  held_cart_id: log.held_cart_id ?? null,
  product_id: log.product_id ?? null,
  quantity_before: Number(log.quantity_before),
  quantity_after: Number(log.quantity_after),
  value_amount: toMajor(log.value_amount),
  reason_code: log.reason_code,
  reason_notes: log.reason_notes || '',
  receipt_printed: log.receipt_printed,
  items_snapshot:
    log.items_snapshot?.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: toMajor(item.unit_price),
    })) ?? null,
  client_created_at: log.client_created_at,
})

export const toWireSecurityEvent = (
  event: LocalSecurityEvent,
  deviceId: string,
): SecurityEventPayload => ({
  id: event.id,
  shift_id: event.shift_id ?? null,
  staff_id: event.staff_id ?? null,
  device_id: event.device_id ?? deviceId,
  event_type: event.event_type,
  severity: event.severity,
  details: event.details ?? {},
  client_created_at: event.client_created_at,
})

export const toWireWasteV2 = (waste: LocalWaste, deviceId: string): WastePayloadV2 => ({
  ...toWireWaste(waste),
  shift_id: waste.shift_id ?? null,
  device_id: waste.device_id ?? deviceId,
  reason_code: waste.reason_code ?? 'OTHER',
  receipt_printed: waste.receipt_printed ?? false,
})

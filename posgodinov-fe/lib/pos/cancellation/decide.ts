/**
 * **Mesin keputusan pembatalan — satu-satunya tempat butir 15 diputuskan.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ATURAN YANG MENGIKAT SELURUH APLIKASI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Berkas ini adalah **satu-satunya** tempat `receipt_printed_at` boleh dibaca
 * untuk menentukan nasib sebuah pembatalan. Menduplikasi logikanya di layar —
 * "kalau sudah tercetak, sembunyikan tombol Void" — adalah pelanggaran Definisi
 * Selesai M13, dan alasannya bukan kerapian:
 *
 * Aturan ini akan berubah. Ambang otoritas, kebijakan per-bisnis, retur lintas
 * outlet — semuanya menyentuh keputusan yang sama. Bila keputusannya tersebar di
 * lima layar, perubahan berikutnya akan mengenai empat di antaranya dan
 * meninggalkan satu yang diam-diam masih memakai aturan lama. Layar yang
 * terlewat itu adalah layar tempat uang bocor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISKRIMINATORNYA SATU KOLOM ([11 §2.1])
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   receipt_printed_at IS NULL      → wilayah VOID
 *   receipt_printed_at IS NOT NULL  → wilayah RETUR
 *
 * Struk yang sudah keluar dari printer adalah dokumen yang berpindah tangan ke
 * pelanggan. Mengubah transaksi asal setelah dokumen itu terbit berarti
 * menerbitkan realitas kedua yang bertentangan dengan kertas di tangan
 * pelanggan — persis lubang yang dipakai kecurangan "cetak dulu, batalkan
 * belakangan, uang masuk kantong".
 *
 * Fungsi ini **murni**: tidak menyentuh Dexie, jaringan, maupun waktu. Seluruh
 * konteks masuk lewat argumen, sehingga ia dapat diuji dengan tabel kasus yang
 * sama persis dengan implementasi Dart (`cancellation_policy.dart`) — lihat
 * `fixtures/cancellation-decision.json` di akar repositori.
 */

import type { ReturnState, TransactionStatus } from '@/lib/types/api'

/** Bentuk minimum transaksi yang dibutuhkan keputusan ini. */
export type CancellableTransaction = {
  id: string
  status: TransactionStatus
  /** `null`/absen = struk belum pernah terbit. */
  receipt_printed_at?: string | null
  return_state?: ReturnState
  items: CancellableItem[]
}

export type CancellableItem = {
  id: string
  product_id: string
  quantity: number
  /** sen */
  unit_price: number
  _product_name?: string
}

/** Satu baris yang masih boleh diretur, beserta sisanya. */
export type ReturnableItem = {
  transaction_item_id: string
  product_id: string
  product_name: string
  /** Kuantitas pada transaksi asal. */
  original_quantity: number
  /** Sudah pernah diretur pada retur-retur sebelumnya. */
  already_returned: number
  /** `original_quantity − already_returned`. Selalu ≥ 0. */
  returnable: number
  /** sen — snapshot harga ASAL, bukan harga hari ini. */
  unit_price: number
}

export type ForbiddenReason =
  /** Sudah dibatalkan; tidak ada yang tersisa untuk dibatalkan lagi. */
  | 'ALREADY_VOIDED'
  /** Seluruh item sudah diretur habis. */
  | 'FULLY_RETURNED'
  /** Transaksi tidak memiliki item sama sekali — data rusak, bukan kasus normal. */
  | 'NOTHING_TO_CANCEL'

export type CancellationDecision =
  | { kind: 'VOID'; requiresAuth: boolean; requiresPrint: true }
  | {
      kind: 'RETURN'
      requiresAuth: boolean
      requiresPrint: true
      returnableItems: ReturnableItem[]
    }
  | { kind: 'FORBIDDEN'; reason: ForbiddenReason }

export type CancellationPolicy = {
  /** `config.require_supervisor_for_void` ([11 §4.4]). */
  requireSupervisorForVoid: boolean
  /** `config.require_supervisor_for_return`. */
  requireSupervisorForReturn: boolean
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  // Bawaan KETAT. Kebijakan longgar secara bawaan berarti outlet yang belum
  // pernah membuka layar pengaturan berjalan tanpa pengendalian apa pun — dan
  // itulah mayoritas outlet.
  requireSupervisorForVoid: true,
  requireSupervisorForReturn: true,
}

/**
 * Menentukan nasib sebuah permintaan pembatalan.
 *
 * @param transaction  Transaksi yang hendak dibatalkan.
 * @param alreadyReturned Peta `transaction_item_id → kuantitas yang sudah
 *   diretur`. Berasal dari `returns` lokal, atau dari
 *   `GET /v1/pos/transactions/{id}/returnable` untuk transaksi hasil pencarian
 *   kode struk. Peta kosong berarti belum pernah ada retur.
 * @param policy Kebijakan dari master data.
 */
export function decideCancellation(
  transaction: CancellableTransaction,
  alreadyReturned: Readonly<Record<string, number>> = {},
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY,
): CancellationDecision {
  // ── 1. Sudah dibatalkan ────────────────────────────────────────────────
  //
  // `CANCELLED` (warisan v1) dan `VOIDED` (v2) sama-sama berarti transaksi ini
  // sudah tidak ada. Memeriksa salah satunya saja akan membuat transaksi lama
  // dapat di-void dua kali, dan server memotong stok dua kali.
  if (transaction.status === 'VOIDED' || transaction.status === 'CANCELLED') {
    return { kind: 'FORBIDDEN', reason: 'ALREADY_VOIDED' }
  }

  // ── 2. Struk BELUM terbit → VOID ───────────────────────────────────────
  //
  // Diperiksa SEBELUM daftar item: transaksi tanpa item pun tetap boleh
  // di-void selama ia belum menjadi dokumen — yang dibatalkan adalah baris
  // keuangannya, bukan isinya.
  const printed = transaction.receipt_printed_at
  if (printed === null || printed === undefined || printed === '') {
    return { kind: 'VOID', requiresAuth: policy.requireSupervisorForVoid, requiresPrint: true }
  }

  // ── 3. Struk SUDAH terbit → RETUR ──────────────────────────────────────
  if (transaction.items.length === 0) {
    // Retur menuntut item yang dikembalikan; transaksi tercetak tanpa item
    // adalah data rusak, bukan kasus operasional.
    return { kind: 'FORBIDDEN', reason: 'NOTHING_TO_CANCEL' }
  }

  const returnableItems = transaction.items.map((item) => {
    const already = alreadyReturned[item.id] ?? 0
    return {
      transaction_item_id: item.id,
      product_id: item.product_id,
      product_name: item._product_name ?? '',
      original_quantity: item.quantity,
      already_returned: already,
      // `Math.max(0, …)` bukan paranoia: server adalah penentu terakhir, dan
      // peta yang datang darinya bisa saja melebihi qty asal bila sebuah retur
      // tersinkron dari perangkat lain di antara dua pembacaan.
      returnable: Math.max(0, item.quantity - already),
      unit_price: item.unit_price,
    }
  })

  const totalReturnable = returnableItems.reduce((sum, item) => sum + item.returnable, 0)
  if (totalReturnable === 0) {
    return { kind: 'FORBIDDEN', reason: 'FULLY_RETURNED' }
  }

  return {
    kind: 'RETURN',
    requiresAuth: policy.requireSupervisorForReturn,
    requiresPrint: true,
    // Baris yang sudah habis diretur TETAP disertakan, dengan `returnable: 0`.
    // Menyembunyikannya membuat kasir mengira barisnya tidak pernah ada dan
    // bertanya-tanya mengapa totalnya tidak cocok.
    returnableItems,
  }
}

/** Label siap tampil — dipakai layar Void dan Retur agar keduanya sejalan. */
export const FORBIDDEN_MESSAGE: Record<ForbiddenReason, string> = {
  ALREADY_VOIDED: 'Transaksi ini sudah dibatalkan sebelumnya.',
  FULLY_RETURNED: 'Seluruh item pada transaksi ini sudah diretur.',
  NOTHING_TO_CANCEL: 'Transaksi ini tidak memiliki item yang dapat diproses.',
}

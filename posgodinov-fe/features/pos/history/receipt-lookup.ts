'use client'

/**
 * Pencarian transaksi lampau — **butir 16** ([11 §M17.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PINTU SEMPIT, DAN KESEMPITANNYA DISENGAJA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Layar Riwayat kini hanya menampilkan shift berjalan. Berkas ini adalah
 * satu-satunya jalan menuju sisanya, dan ia dijaga tiga hal:
 *
 *   1. **Minimal 6 karakter.** "Cari `A`" adalah penelusuran massal yang
 *      dilakukan sedikit demi sedikit.
 *   2. **Satu hasil.** Bukan daftar — lihat catatan pada `lookupTransaction`.
 *   3. **10 pencarian per menit.** Kasir yang benar-benar mencari satu struk
 *      tidak pernah mendekati batas ini; yang mendekatinya sedang menebak.
 */

import { lookupTransaction } from '@/lib/api/endpoints/pos-sync'
import {
  paymentSummaryMethodSchema,
  type PaymentSummaryMethod,
} from '@/lib/constants/payment'
import type { LocalTransaction } from '@/lib/db/models'
import { findTransactionByCode } from '@/lib/db/repositories/transaction.repo'
import { toMinor } from '@/lib/money'

/** Panjang minimum kode. Cerminan `service.MinLookupCodeLength` di server. */
export const MIN_CODE_LENGTH = 6

/** Batas pencarian per jendela. */
export const LOOKUP_LIMIT = 10
export const LOOKUP_WINDOW_MS = 60_000

export type LookupResult =
  | { status: 'found'; transaction: LocalTransaction; source: 'local' | 'server' }
  | { status: 'not-found' }
  | { status: 'too-short' }
  | { status: 'rate-limited'; retryAfterMs: number }
  | { status: 'offline' }

/**
 * Jejak waktu pencarian dalam jendela berjalan.
 *
 * Modul-level, bukan `useState`: batasnya harus bertahan melewati perpindahan
 * layar. Kasir yang menekan batas lalu membuka Kasir dan kembali ke Riwayat
 * tidak boleh mendapat sepuluh percobaan baru.
 *
 * ⚠️ Ini pembatas KENYAMANAN, bukan pengamanan. Ia hidup di memori dan hilang
 * saat aplikasi ditutup; penegakan sesungguhnya harus ada di server. Yang
 * dicegah di sini adalah kasir yang menebak kode secara beruntun tanpa
 * berpikir — bukan penyerang yang menulis skripnya sendiri.
 */
const attempts: number[] = []

function rateCheck(now: number): { ok: true } | { ok: false; retryAfterMs: number } {
  while (attempts.length > 0 && now - attempts[0]! > LOOKUP_WINDOW_MS) attempts.shift()

  if (attempts.length >= LOOKUP_LIMIT) {
    const oldest = attempts[0]!
    return { ok: false, retryAfterMs: LOOKUP_WINDOW_MS - (now - oldest) }
  }
  return { ok: true }
}

/**
 * Mencari kode, lokal dulu lalu server.
 *
 * Urutannya bukan optimasi semata: transaksi shift berjalan pasti ada di
 * perangkat, dan menuntut jaringan untuk sesuatu yang sudah dipegang berarti
 * fitur ini mati di outlet tanpa sinyal — tempat ia justru paling dibutuhkan
 * ketika pelanggan datang membawa struk.
 *
 * Pencarian lokal **tidak** dihitung terhadap batas: ia tidak menyentuh server
 * dan tidak dapat dipakai menebak apa pun yang tidak sudah ada di perangkat.
 */
export async function lookupByCode(rawCode: string): Promise<LookupResult> {
  const code = rawCode.trim()
  if (code.length < MIN_CODE_LENGTH) return { status: 'too-short' }

  const local = await findTransactionByCode(code)
  if (local) return { status: 'found', transaction: local, source: 'local' }

  const gate = rateCheck(Date.now())
  if (!gate.ok) return { status: 'rate-limited', retryAfterMs: gate.retryAfterMs }
  attempts.push(Date.now())

  try {
    const remote = await lookupTransaction(code)

    // Bentuk kawat → model lokal. **Tidak disimpan ke Dexie**: transaksi milik
    // shift lain tidak boleh muncul di daftar riwayat shift berjalan hanya
    // karena pernah dicari. Ia hidup sebagai hasil pencarian saja.
    return {
      status: 'found',
      source: 'server',
      transaction: {
        id: remote.id,
        shift_id: remote.shift_id,
        customer_name: remote.customer_name ?? '',
        total_amount: toMinor(remote.total_amount),
        // Nilai server disaring lewat kontrak beku sebelum masuk model lokal.
        // `payment_method` adalah VARCHAR bebas di server ([05 §3.3]); baris
        // lama dapat memuat nilai yang sudah tidak dikenal aplikasi ini, dan
        // meloloskannya apa adanya membuat label pembayaran merender
        // `undefined`.
        payment_method: paymentSummaryMethodSchema.safeParse(remote.payment_method).success
          ? (remote.payment_method as PaymentSummaryMethod)
          : 'CASH',
        status: remote.status,
        cancel_notes: remote.cancel_notes ?? '',
        client_created_at: remote.client_created_at,
        items: (remote.items ?? []).map((item) => ({
          id: item.id,
          transaction_id: remote.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: toMinor(item.unit_price),
          _product_name: '',
        })),
        _synced: 1,
        _syncAttempts: 0,
        _syncError: null,
      },
    }
  } catch (error) {
    // `404` dari server dan kegagalan jaringan dibedakan: yang pertama berarti
    // kodenya memang tidak ada, yang kedua berarti kasir harus mencoba lagi
    // nanti. Menyamakannya membuat kasir menyerah mencari struk yang sebenarnya
    // ada.
    const status = (error as { status?: number }).status
    if (status === 404) return { status: 'not-found' }
    return { status: 'offline' }
  }
}

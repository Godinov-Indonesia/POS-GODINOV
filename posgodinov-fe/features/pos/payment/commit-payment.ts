'use client'

/**
 * Penulisan transaksi — jalur tunggal untuk SELURUH sub-layar pembayaran
 * ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SATU PENULIS, EMPAT LAYAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `payment-cash`, `payment-card`, dan `payment-split` seluruhnya bermuara di
 * sini. Membiarkan masing-masing memanggil `saveTransaction` sendiri berarti
 * aturan yang mengikat — ringkasan `SPLIT` hanya sah bila tender > 1, keranjang
 * dibersihkan SETELAH penulisan, pesanan tertahan dihapus SETELAH pembayaran —
 * hidup di tiga tempat, dan yang satu pasti akan tertinggal saat aturannya
 * berubah.
 */

import { useCartStore } from '@/features/pos/cart/cart-store'
import { usePaymentDraftStore, toLocalPayments, type TenderDraft } from '@/features/pos/payment/payment-draft-store'
import { posReplace } from '@/features/pos/router/usePosRouter'
import { cartTotal } from '@/features/pos/cart/cart-math'
import type { PaymentSummaryMethod } from '@/lib/constants/payment'
import { removeHeldCart } from '@/lib/db/repositories/held-cart.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { saveTransaction } from '@/lib/db/repositories/transaction.repo'
import { newUuid } from '@/lib/uuid'

export type CommitOutcome =
  | { ok: true; transactionId: string }
  | { ok: false; error: string }

/**
 * Menyimpan transaksi beserta rincian tendernya, lalu berpindah ke struk.
 *
 * ⚠️ Pemanggil WAJIB memastikan `Σ tenders.amount === cartTotal`. Pemeriksaan
 * itu ada juga di `assertTenderIntegrity()` saat sinkronisasi, tetapi menunggu
 * sampai sana berarti transaksi tidak seimbang sudah terlanjur tertulis dan
 * masuk antrean — lalu ditolak server berulang kali tanpa cara memperbaikinya
 * dari perangkat.
 */
export async function commitPayment(params: {
  tenders: TenderDraft[]
  /** Diisi HANYA pada pembayaran tunai. */
  cashReceivedMinor?: number
  changeMinor?: number
}): Promise<CommitOutcome> {
  const cart = useCartStore.getState()
  const total = cartTotal(cart.lines)

  if (!cart.lines.length) return { ok: false, error: 'Keranjang kosong.' }
  if (params.tenders.length === 0) return { ok: false, error: 'Belum ada pembayaran yang dicatat.' }

  const tendered = params.tenders.reduce((sum, t) => sum + t.amount, 0)
  if (tendered !== total) {
    return {
      ok: false,
      error: `Rincian pembayaran belum menutup total. Kurang ${(total - tendered) / 100} rupiah.`,
    }
  }

  const shift = await getOpenShift()
  if (!shift) return { ok: false, error: 'Tidak ada shift terbuka. Buka shift terlebih dahulu.' }

  try {
    const payments = toLocalPayments(params.tenders, newUuid)

    // Ringkasan v1-compat. `SPLIT` **hanya** sah bila benar-benar ada dua tender
    // atau lebih untuk menjelaskannya — `assertTenderIntegrity` menolak baris
    // `SPLIT` yang rinciannya tidak dapat direkonstruksi.
    const summary: PaymentSummaryMethod =
      payments.length > 1 ? 'SPLIT' : payments[0]!.method

    const transaction = await saveTransaction({
      shiftId: shift.id,
      customerName: cart.customerName.trim(),
      totalAmountMinor: total,
      paymentMethod: summary,
      payments,
      items: cart.lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        _product_name: line.product_name,
      })),
      cashReceivedMinor: params.cashReceivedMinor,
      changeMinor: params.changeMinor,
    })

    // Pesanan tertahan dihapus SETELAH transaksi tersimpan. Urutan sebaliknya
    // membuka jendela di mana pesanan sudah lenyap tetapi transaksinya gagal
    // ditulis — dan isinya tidak dapat dipulihkan dari mana pun.
    if (cart.fromHeldCartId) await removeHeldCart(cart.fromHeldCartId)

    cart.clear()
    usePaymentDraftStore.getState().reset()

    // `posReplace`, bukan `posNavigate`: seluruh rantai sub-layar pembayaran
    // dibuang dari riwayat. Tombol back dari layar struk harus kembali ke
    // Kasir, bukan ke form kartu milik transaksi yang sudah selesai.
    posReplace('receipt', { transactionId: transaction.id })

    return { ok: true, transactionId: transaction.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan transaksi.',
    }
  }
}

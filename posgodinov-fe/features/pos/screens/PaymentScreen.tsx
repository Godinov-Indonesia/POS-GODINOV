'use client'

import { ArrowLeft, Banknote, CreditCard, QrCode, Split, Landmark } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { cartTotal } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { usePaymentDraftStore } from '@/features/pos/payment/payment-draft-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { PosScreen } from '@/features/pos/router/screens'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants/payment'

/**
 * P-06 Pembayaran — **pemilih metode**, butir 11 ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYAR PENUH, BUKAN MODAL — DAN SUB-LANGKAHNYA JUGA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `payment` sudah berupa rute sejak v1. Yang berubah pada M17.2 adalah
 * SUB-LANGKAHNYA: input tunai, form kartu, dan penyusunan split dulu berupa
 * cabang `if` di dalam layar ini. Konsekuensinya, tombol back perangkat
 * menutup seluruh pembayaran — kasir yang salah pilih metode kehilangan
 * langkahnya dan mengulang dari keranjang.
 *
 * Kini masing-masing punya rute sendiri beserta entri `history.pushState`-nya,
 * sehingga back mundur SATU langkah.
 *
 * ⚠️ Kembali dari sub-layar **tidak pernah menghapus keranjang**. Keranjang
 * hanya dibersihkan oleh `commitPayment()`, setelah transaksi benar-benar
 * tertulis.
 */

/** Metode → rute penanganannya. */
const ROUTE_FOR: Record<PaymentMethod, PosScreen> = {
  CASH: 'payment-cash',
  QRIS: 'payment-card',
  DEBIT: 'payment-card',
  CREDIT: 'payment-card',
  TRANSFER: 'payment-card',
}

const ICON_FOR: Record<PaymentMethod, typeof Banknote> = {
  CASH: Banknote,
  QRIS: QrCode,
  DEBIT: CreditCard,
  CREDIT: CreditCard,
  TRANSFER: Landmark,
}

/**
 * Metode yang ditawarkan kasir.
 *
 * `CREDIT` kini ikut ditampilkan — form kartunya lahir bersama fase ini. Sampai
 * M17.2, menambahkannya berarti memunculkan tombol yang alur pembayarannya
 * belum ada ([05 §3.3]).
 */
const OFFERED: readonly PaymentMethod[] = ['CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER']

export function PaymentScreen() {
  const lines = useCartStore((s) => s.lines)
  const customerName = useCartStore((s) => s.customerName)
  const setCustomerName = useCartStore((s) => s.setCustomerName)
  const resetTenders = usePaymentDraftStore((s) => s.reset)

  const total = cartTotal(lines)

  // Draf tender dibersihkan setiap kali kasir kembali ke pemilih metode.
  //
  // Tanpa ini, tender dari percobaan sebelumnya — mis. split yang dibatalkan —
  // ikut terbawa ke pembayaran berikutnya, dan totalnya tidak akan pernah
  // seimbang tanpa kasir tahu mengapa.
  React.useEffect(() => {
    resetTenders()
  }, [resetTenders])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Keranjang
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Pembayaran</h1>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
        <span className="text-pos-base text-fg-muted">Total</span>
        <Money minor={total} size="2xl" />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-pos-sm font-medium text-fg">Nama pelanggan (opsional)</span>
        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </label>

      <span className="mt-2 text-pos-sm font-medium text-fg">Metode pembayaran</span>

      {/* Satu kolom, target 64 dp. Grid dua kolom memuat lebih banyak metode di
          layar, tetapi memaksa jempol bergerak mendatar — dan salah tekan di
          sini memilih metode yang salah untuk uang yang sudah diterima. */}
      <div className="flex flex-col gap-2">
        {OFFERED.map((method) => {
          const Icon = ICON_FOR[method]
          return (
            <Button
              key={method}
              variant="neutral"
              size="xl"
              block
              className="justify-start"
              onClick={() => posNavigate(ROUTE_FOR[method], { method })}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {PAYMENT_METHOD_LABELS[method]}
            </Button>
          )
        })}

        <Button
          variant="neutral"
          size="xl"
          block
          className="justify-start"
          onClick={() => posNavigate('payment-split')}
        >
          <Split className="size-5 shrink-0" aria-hidden="true" />
          Bayar Terpisah (Split)
        </Button>
      </div>
    </div>
  )
}

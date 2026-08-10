'use client'

import { ArrowLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { toastApiError } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { calculateChange, cartTotal, fastCashPresets } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants/payment'
import { removeHeldCart } from '@/lib/db/repositories/held-cart.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { saveTransaction } from '@/lib/db/repositories/transaction.repo'
import { cn } from '@/lib/utils/cn'

/**
 * P-06 Pembayaran — docs/06 §3.5 & §4.6.
 *
 * Metode pembayaran **hanya** dirender dari `PAYMENT_METHODS.map(...)`
 * ([05 §3.3 butir 3]). Tidak ada input teks bebas dan tidak ada opsi
 * "Lainnya": kolom `payment_method` adalah VARCHAR bebas tanpa enum di
 * database, dan satu salah ketik memecah pengelompokan laporan **secara
 * permanen** — tidak ada endpoint untuk memperbaiki data lama.
 */
export function PaymentScreen() {
  const lines = useCartStore((s) => s.lines)
  const customerName = useCartStore((s) => s.customerName)
  const setCustomerName = useCartStore((s) => s.setCustomerName)
  const fromHeldCartId = useCartStore((s) => s.fromHeldCartId)
  const clearCart = useCartStore((s) => s.clear)
  const staffId = usePosAuthStore((s) => s.staffId)

  const [method, setMethod] = React.useState<PaymentMethod>('CASH')
  const { digits, setDigits, append, backspace, clear } = useDigitInput(9)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const total = cartTotal(lines)
  const isCash = method === 'CASH'
  const cashReceived = isCash ? digitsToMinor(digits) : total
  const change = calculateChange(cashReceived, total)
  const insufficient = isCash && change < 0

  const presets = React.useMemo(() => fastCashPresets(total), [total])

  const submit = async () => {
    if (!staffId || insufficient || !lines.length) return

    setSaving(true)
    setError(null)

    try {
      const shift = await getOpenShift()
      if (!shift) {
        setError('Tidak ada shift terbuka. Buka shift terlebih dahulu.')
        return
      }

      // Transaksi ditulis ke Dexie SEBELUM perintah cetak ([05 §1.6.5]).
      // Printer mati adalah masalah operasional, bukan alasan menghilangkan
      // penjualan yang uangnya sudah diterima.
      const transaction = await saveTransaction({
        shiftId: shift.id,
        customerName: customerName.trim(),
        totalAmountMinor: total,
        paymentMethod: method,
        items: lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          _product_name: line.product_name,
        })),
        cashReceivedMinor: isCash ? cashReceived : undefined,
        changeMinor: isCash ? change : undefined,
      })

      if (fromHeldCartId) await removeHeldCart(fromHeldCartId)

      clearCart()
      posNavigate('receipt', { transactionId: transaction.id })
    } catch (e) {
      toastApiError(e, 'Gagal menyimpan transaksi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row">
      <div className="flex flex-col gap-3 lg:w-[24rem]">
        <Button variant="ghost" className="self-start" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali ke keranjang
        </Button>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
          <span className="text-pos-base text-fg-muted">Total</span>
          <Money minor={total} size="2xl" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-pos-sm font-medium text-fg">Metode pembayaran</span>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((value) => (
              <Button
                key={value}
                variant={method === value ? 'primary' : 'neutral'}
                size="lg"
                onClick={() => setMethod(value)}
                aria-pressed={method === value}
              >
                {PAYMENT_METHOD_LABELS[value]}
              </Button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-pos-sm font-medium text-fg">Nama pelanggan (opsional)</span>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {isCash ? (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-pos-base text-fg-muted">Uang diterima</span>
                <Money minor={cashReceived} size="2xl" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-pos-base text-fg-muted">Kembalian</span>
                <Money
                  minor={change}
                  size="2xl"
                  tone={insufficient ? 'danger' : change > 0 ? 'success' : 'default'}
                />
              </div>
              {insufficient ? (
                <p role="alert" className="text-pos-sm text-danger">
                  ⚠ Uang yang diterima belum menutupi total.
                </p>
              ) : null}
            </div>

            {/* Fast-Cash 72px — kelas "Kritis": salah tekan di sini membuat
                uang fisik keluar salah ([06 §2.1]). */}
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  variant="neutral"
                  size="cash"
                  onClick={() => setDigits(String(preset / 100))}
                >
                  <Money minor={preset} size="lg" />
                </Button>
              ))}
            </div>

            <div className="max-w-xs">
              <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={saving} />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4 text-pos-sm text-fg-muted">
            Metode {PAYMENT_METHOD_LABELS[method]} dicatat sebagai lunas sebesar total transaksi.
            Sistem ini tidak terhubung ke payment gateway mana pun — konfirmasi pembayaran dilakukan
            kasir secara manual.
          </div>
        )}

        {error ? (
          <p role="alert" className="text-pos-sm text-danger">
            ⚠ {error}
          </p>
        ) : null}

        <Button
          variant="cash"
          size="cash"
          block
          className={cn('mt-auto')}
          disabled={saving || insufficient || !lines.length}
          onClick={submit}
        >
          {saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI'}
        </Button>
      </div>
    </div>
  )
}

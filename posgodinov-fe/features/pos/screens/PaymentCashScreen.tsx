'use client'

import { ArrowLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { calculateChange, cartTotal, fastCashPresets } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { commitPayment } from '@/features/pos/payment/commit-payment'
import { posNavigate } from '@/features/pos/router/usePosRouter'

/**
 * P-06a Pembayaran Tunai — layar penuh ([11 §M17.2]).
 *
 * Keypad 56 dp dan Fast-Cash 72 dp menempati layar penuh, bukan setengah panel
 * di samping pemilih metode. Uang tunai adalah satu-satunya metode yang
 * menuntut kasir mengetik angka sambil memegang uang fisik — dan itu pekerjaan
 * dua tangan yang tidak boleh berbagi layar dengan apa pun.
 *
 * ⚠️ Tombol kembali **tidak menghapus keranjang**. Ia hanya mundur ke pemilih
 * metode; keranjang dibersihkan `commitPayment()` setelah transaksi tertulis.
 */
export function PaymentCashScreen() {
  const lines = useCartStore((s) => s.lines)
  const { digits, setDigits, append, backspace, clear } = useDigitInput(9)
  const [saving, setSaving] = React.useState(false)

  const total = cartTotal(lines)
  const cashReceived = digitsToMinor(digits)
  const change = calculateChange(cashReceived, total)
  const insufficient = change < 0

  const presets = React.useMemo(() => fastCashPresets(total), [total])

  const submit = async () => {
    setSaving(true)
    try {
      const outcome = await commitPayment({
        tenders: [{ method: 'CASH', amount: total }],
        cashReceivedMinor: cashReceived,
        changeMinor: change,
      })
      if (!outcome.ok) toast.error(outcome.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('payment')} disabled={saving}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Ganti metode
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Tunai</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-pos-base text-fg-muted">Total</span>
          <Money minor={total} size="xl" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
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

      {/* Fast-Cash 72 dp — kelas "Kritis": salah tekan membuat uang fisik keluar
          salah ([06 §2.1]). */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset}
            variant="neutral"
            size="cash"
            onClick={() => setDigits(String(preset / 100))}
            disabled={saving}
          >
            <Money minor={preset} size="lg" />
          </Button>
        ))}
      </div>

      <div className="max-w-sm">
        <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={saving} />
      </div>

      <Button
        variant="cash"
        size="cash"
        block
        className="mt-auto"
        disabled={saving || insufficient || !lines.length}
        onClick={submit}
      >
        {saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI'}
      </Button>
    </div>
  )
}

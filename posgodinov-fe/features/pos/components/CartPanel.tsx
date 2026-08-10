'use client'

import { Minus, Pause, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Money, Num } from '@/components/ui/money'
import { cartItemCount, cartTotal, lineTotal } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'

/**
 * `CartPanel` — docs/06 §4.4 & §4.5.
 *
 * Keranjang **tidak pernah hilang** dari layar (prinsip #2, [06 §0.2]).
 * "Kosongkan" diletakkan di header panel, bukan dekat tombol Bayar: aksi
 * destruktif tidak boleh bersebelahan dengan aksi utama ([06 §2.2]).
 */
export function CartPanel({
  onPay,
  onHold,
}: {
  onPay: () => void
  onHold: () => void
}) {
  const lines = useCartStore((s) => s.lines)
  const increment = useCartStore((s) => s.increment)
  const removeLine = useCartStore((s) => s.removeLine)
  const clear = useCartStore((s) => s.clear)
  const [confirmClear, setConfirmClear] = React.useState(false)

  const total = cartTotal(lines)
  const count = cartItemCount(lines)

  return (
    <aside className="flex w-full flex-col border-l border-border bg-bg-muted lg:w-[24rem]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <ShoppingCart className="size-5 text-fg-muted" aria-hidden="true" />
        <span className="text-pos-base font-semibold text-fg">Keranjang</span>
        <Num className="text-pos-sm text-fg-muted">{count} item</Num>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-danger"
          disabled={!lines.length}
          onClick={() => (lines.length >= 1 ? setConfirmClear(true) : clear())}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Kosongkan
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-pos-sm text-fg-muted">
            Ketuk produk di sebelah kiri untuk menambahkannya.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lines.map((line) => (
              <li key={line.product_id} className="flex flex-col gap-2 bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-pos-base font-medium text-fg">{line.product_name}</span>
                  <Money minor={lineTotal(line)} size="md" />
                </div>

                <div className="flex items-center gap-2">
                  {/* Stepper 56px — kelas "Sering" ([06 §2.1]). */}
                  <Button
                    variant="neutral"
                    size="lg"
                    className="w-14"
                    aria-label={`Kurangi ${line.product_name}`}
                    onClick={() => increment(line.product_id, -1)}
                  >
                    <Minus className="size-5" aria-hidden="true" />
                  </Button>

                  <Num className="w-10 text-center text-pos-md font-semibold">{line.quantity}</Num>

                  <Button
                    variant="neutral"
                    size="lg"
                    className="w-14"
                    aria-label={`Tambah ${line.product_name}`}
                    onClick={() => increment(line.product_id, 1)}
                  >
                    <Plus className="size-5" aria-hidden="true" />
                  </Button>

                  <Money minor={line.unit_price} size="sm" tone="muted" className="ml-auto" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    aria-label={`Hapus ${line.product_name}`}
                    onClick={() => removeLine(line.product_id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="text-pos-base text-fg-muted">Total</span>
          <Money minor={total} size="xl" />
        </div>

        <div className="flex items-center gap-6">
          {/* Jarak 24px dari Bayar — bobot warna juga berbeda ([06 §2.2]). */}
          <Button variant="neutral" size="xl" disabled={!lines.length} onClick={onHold}>
            <Pause className="size-5" aria-hidden="true" />
            Tahan
          </Button>

          <Button
            variant="primary"
            size="xl"
            className="flex-1"
            disabled={!lines.length}
            onClick={onPay}
          >
            BAYAR
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clear()
          setConfirmClear(false)
        }}
        title="Kosongkan keranjang?"
        description={`${count} item akan dibuang. Bila pesanan ini masih mungkin dilanjutkan, gunakan "Tahan" agar dapat diambil kembali.`}
        confirmLabel="Kosongkan"
      />
    </aside>
  )
}

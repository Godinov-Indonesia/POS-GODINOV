'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Pause, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { HeldCart } from '@/lib/db/models'
import { getHeldCart, listHeldCarts, removeHeldCart } from '@/lib/db/repositories/held-cart.repo'
import { formatTimeId } from '@/lib/time'

/**
 * P-08 Pesanan Ditahan — docs/04 §A.1.
 *
 * **Murni lokal — tidak pernah dikirim ke server.** Backend tidak punya konsep
 * cart maupun checkout ([05 §0.4]); seluruh fitur ini hidup di perangkat.
 */
export function HeldCartsScreen() {
  const carts = useLiveQuery(() => listHeldCarts(), [], [] as HeldCart[])
  const loadLines = useCartStore((s) => s.loadLines)
  const currentLines = useCartStore((s) => s.lines)
  const [pendingDelete, setPendingDelete] = React.useState<HeldCart | null>(null)
  const [pendingResume, setPendingResume] = React.useState<HeldCart | null>(null)

  const resume = async (cart: HeldCart) => {
    const fresh = await getHeldCart(cart.id)
    if (!fresh) return

    loadLines(
      fresh.items.map((item) => ({
        product_id: item.product_id,
        product_name: item._product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
      })),
      // Baris hold baru dihapus SETELAH pembayaran berhasil (P-06). Menghapusnya
      // di sini berarti pesanan hilang bila kasir membatalkan di tengah jalan.
      fresh.id,
    )
    posNavigate('register')
  }

  const total = (cart: HeldCart) =>
    cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Pesanan Ditahan</h1>
      </div>

      {carts.length === 0 ? (
        <EmptyState
          icon={Pause}
          title="Tidak ada pesanan ditahan"
          description="Gunakan tombol “Tahan” di keranjang untuk menyimpan pesanan sementara tanpa menutup transaksi."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {carts.map((cart) => (
            <li
              key={cart.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-pos-base font-semibold text-fg">{cart.label}</span>
                <span className="text-pos-xs text-fg-muted">
                  <Num>{cart.items.length}</Num> item · {formatTimeId(cart.created_at)}
                </span>
              </div>

              <Money minor={total(cart)} size="lg" />

              <Button
                variant="primary"
                size="lg"
                onClick={() =>
                  currentLines.length ? setPendingResume(cart) : void resume(cart)
                }
              >
                Ambil
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-danger"
                aria-label={`Buang pesanan ${cart.label}`}
                onClick={() => setPendingDelete(cart)}
              >
                <Trash2 className="size-5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeHeldCart(pendingDelete.id)
          setPendingDelete(null)
        }}
        title={`Buang pesanan ${pendingDelete?.label ?? ''}?`}
        description="Pesanan yang ditahan belum pernah menjadi transaksi, sehingga tidak ada data keuangan yang hilang."
        confirmLabel="Buang"
      />

      <ConfirmDialog
        open={!!pendingResume}
        onClose={() => setPendingResume(null)}
        onConfirm={async () => {
          if (pendingResume) await resume(pendingResume)
          setPendingResume(null)
        }}
        title="Ganti keranjang yang sedang aktif?"
        description="Keranjang yang sedang terbuka akan digantikan oleh pesanan ini. Tahan dulu keranjang aktif bila masih dibutuhkan."
        confirmLabel="Ganti"
      />
    </div>
  )
}

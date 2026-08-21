'use client'

import { Minus, Pause, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Money, Num } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { cartItemCount, cartTotal, lineTotal, type CartLine } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { VoidSheet } from '@/features/pos/components/VoidSheet'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { VOID_THRESHOLD_QTY } from '@/lib/constants/cancellation'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { recordVoidLog } from '@/lib/db/repositories/void-log.repo'
import { readPosConfig } from '@/lib/pos/config'

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
  const clear = useCartStore((s) => s.clear)
  const [confirmClear, setConfirmClear] = React.useState(false)

  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)

  // ── BUTIR 5 — Strict Qty Audit ([11 §M13.4]) ──────────────────────────────
  //
  // Ambang datang dari master data agar pemilik dapat mengubahnya tanpa rilis
  // baru; bawaannya dipakai sampai `config` pertama tiba.
  const [threshold, setThreshold] = React.useState(VOID_THRESHOLD_QTY)
  const [requiresAuth, setRequiresAuth] = React.useState(true)
  React.useEffect(() => {
    let alive = true
    void readPosConfig().then((config) => {
      if (!alive) return
      setThreshold(config.voidThresholdQty)
      setRequiresAuth(config.requireSupervisorForVoid)
    })
    return () => {
      alive = false
    }
  }, [])

  /**
   * Penurunan yang tertahan ambang dan menunggu pembatalan tercatat.
   *
   * `lines` berisi satu baris untuk penurunan stepper, atau SELURUH baris untuk
   * "Kosongkan" — lihat catatan pada [requestClear].
   */
  const [pendingVoid, setPendingVoid] = React.useState<{
    kind: 'line' | 'clear'
    entries: { line: CartLine; nextQuantity: number; decrease: number }[]
  } | null>(null)
  const [voidBusy, setVoidBusy] = React.useState(false)

  const pendingDecrease = pendingVoid?.entries.reduce((sum, e) => sum + e.decrease, 0) ?? 0
  const pendingValue =
    pendingVoid?.entries.reduce((sum, e) => sum + e.decrease * e.line.unit_price, 0) ?? 0

  /**
   * Satu-satunya jalan menurunkan kuantitas dari layar ini.
   *
   * Baik tombol minus maupun tombol hapus melewatinya. Membiarkan tombol hapus
   * memakai jalur lain akan membuat butir 5 tidak berguna: kasir cukup menekan
   * hapus alih-alih menekan minus enam kali.
   */
  const requestDecrease = (line: CartLine, nextQuantity: number) => {
    const attempt = useCartStore.getState().canDecrementTo(line.product_id, nextQuantity, threshold)

    if (attempt.ok) {
      useCartStore.getState().applyAudited(line.product_id, nextQuantity)
      return
    }

    setPendingVoid({
      kind: 'line',
      entries: [{ line, nextQuantity, decrease: attempt.totalDecrease }],
    })
  }

  /**
   * "Kosongkan" tunduk pada ambang yang SAMA.
   *
   * Tanpa ini butir 5 punya pintu belakang selebar pintu depan: kasir yang
   * ditahan tombol minus cukup menekan "Kosongkan" dan sepuluh unit lenyap
   * tanpa satu pun baris audit. Yang diperiksa adalah penurunan gabungan
   * seluruh keranjang, karena itulah yang benar-benar hilang.
   */
  const requestClear = () => {
    const state = useCartStore.getState()
    const entries = state.lines.map((line) => ({
      line,
      nextQuantity: 0,
      decrease: (state.peakQuantity[line.product_id] ?? line.quantity),
    }))

    const totalDecrease = entries.reduce((sum, e) => sum + e.decrease, 0)
    if (totalDecrease > threshold) {
      setPendingVoid({ kind: 'clear', entries })
      return
    }

    setConfirmClear(true)
  }

  const commitPendingVoid = async ({
    reasonCode,
    reasonNotes,
  }: {
    reasonCode: string
    reasonNotes: string
  }) => {
    if (!pendingVoid || !staffId) return

    setVoidBusy(true)
    try {
      const shift = await getOpenShift()
      if (!shift) {
        toast.error('Tidak ada shift aktif — pembatalan harus terikat pada satu shift.')
        return
      }

      // Satu baris `void_logs` per baris keranjang: `scope = CART_LINE`
      // mensyaratkan `product_id`, dan `ck_void_scope_ref` di PostgreSQL
      // menolak baris tanpanya ([11 §3.2]). Satu log gabungan tidak dapat
      // menyatakan produk mana yang lenyap.
      for (const entry of pendingVoid.entries) {
        if (entry.decrease <= 0) continue

        await recordVoidLog({
          scope: 'CART_LINE',
          shiftId: shift.id,
          staffId,
          productId: entry.line.product_id,
          // `quantity_before` adalah PUNCAK, bukan kuantitas saat ini: yang
          // diaudit adalah seluruh penurunan sejak barang itu masuk keranjang,
          // bukan hanya ketukan terakhir.
          quantityBefore: entry.nextQuantity + entry.decrease,
          quantityAfter: entry.nextQuantity,
          valueAmountMinor: entry.decrease * entry.line.unit_price,
          reasonCode,
          reasonNotes,
          cashierName: staffName ?? undefined,
          itemsSnapshot: [
            {
              product_id: entry.line.product_id,
              product_name: entry.line.product_name,
              quantity: entry.decrease,
              unit_price: entry.line.unit_price,
            },
          ],
        })
      }

      if (pendingVoid.kind === 'clear') {
        clear()
      } else {
        for (const entry of pendingVoid.entries) {
          useCartStore.getState().applyAudited(entry.line.product_id, entry.nextQuantity)
        }
      }

      toast.success('Pembatalan tercatat. Struk pembatalan sedang dicetak.')
      setPendingVoid(null)
    } finally {
      setVoidBusy(false)
    }
  }

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
          onClick={requestClear}
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

                <div className="flex items-center gap-3">
                  <Button
                    variant="neutral"
                    size="icon"
                    className={`h-12 w-12 text-pos-lg font-bold shrink-0 transition-colors ${
                      line.quantity === 1 ? 'bg-danger-subtle text-danger border-danger/30 hover:bg-danger/20' : ''
                    }`}
                    aria-label={line.quantity === 1 ? `Hapus ${line.product_name}` : `Kurangi ${line.product_name}`}
                    onClick={() => requestDecrease(line, line.quantity - 1)}
                  >
                    {line.quantity === 1 ? (
                      <Trash2 className="size-5" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <Minus className="size-5" strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </Button>

                  <Num className="w-10 text-center text-pos-lg font-bold">{line.quantity}</Num>

                  <Button
                    variant="neutral"
                    size="icon"
                    className="h-12 w-12 text-pos-lg font-bold shrink-0"
                    aria-label={`Tambah ${line.product_name}`}
                    onClick={() => increment(line.product_id, 1)}
                  >
                    <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
                  </Button>

                  <Money minor={line.unit_price} size="sm" tone="muted" className="ml-auto" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger h-12 w-12 shrink-0"
                    aria-label={`Hapus ${line.product_name}`}
                    onClick={() => requestDecrease(line, 0)}
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
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

      <VoidSheet
        open={!!pendingVoid}
        title="Penurunan besar memerlukan pembatalan"
        description={
          pendingVoid ? (
            <>
              <Num>{pendingDecrease}</Num> unit{' '}
              {pendingVoid.kind === 'clear' ? (
                <>dari <Num>{pendingVoid.entries.length}</Num> produk</>
              ) : (
                <strong>{pendingVoid.entries[0]?.line.product_name}</strong>
              )}{' '}
              akan lenyap dari keranjang ini — melewati ambang <Num>{threshold}</Num> unit.
              Penurunan sebesar ini tidak dapat lewat tombol biasa; ia dicatat sebagai pembatalan
              beserta alasannya.
            </>
          ) : null
        }
        valueMinor={pendingValue}
        requiresAuth={requiresAuth}
        busy={voidBusy}
        submitLabel="Catat & turunkan"
        onClose={() => setPendingVoid(null)}
        onSubmit={commitPendingVoid}
      />

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

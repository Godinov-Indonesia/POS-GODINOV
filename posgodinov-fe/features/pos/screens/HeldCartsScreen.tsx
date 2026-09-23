'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban, Pause } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { VoidSheet } from '@/features/pos/components/VoidSheet'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { HeldCart } from '@/lib/db/models'
import { getHeldCart, listHeldCarts, removeHeldCart } from '@/lib/db/repositories/held-cart.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { recordVoidLog } from '@/lib/db/repositories/void-log.repo'
import { readPosConfig } from '@/lib/pos/config'
import { formatTimeId } from '@/lib/time'

/**
 * P-08 Pesanan Ditahan — docs/04 §A.1, dirombak pada Fase M13.5 (**butir 13**).
 *
 * **Murni lokal — tidak pernah dikirim ke server.** Backend tidak punya konsep
 * cart maupun checkout ([05 §0.4]); seluruh fitur ini hidup di perangkat.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIDAK ADA TOMBOL HAPUS DI LAYAR INI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tombol "Buang" beserta `ConfirmDialog`-nya **dihapus dari kode**, bukan
 * disembunyikan dengan `hidden` atau `Visibility` — kode yang disembunyikan
 * akan dinyalakan kembali oleh orang yang tidak tahu mengapa ia dimatikan.
 *
 * Alasannya: pesanan tertahan **tidak pernah ada di server**. Menghapusnya
 * berarti isinya lenyap tanpa jejak — tidak ada transaksi, tidak ada stok
 * bergerak, tidak ada baris untuk diaudit. Itulah persis bentuk kecurangan yang
 * butir 13 dibangun untuk menutupnya: menahan pesanan besar, menerima uangnya,
 * lalu membuang pesanannya.
 *
 * Karena itu pembatalan menempuh alur Void, dan `items_snapshot` WAJIB
 * dilampirkan utuh — snapshot itu satu-satunya salinan isi pesanan yang akan
 * pernah dilihat auditor.
 */
export function HeldCartsScreen() {
  const carts = useLiveQuery(() => listHeldCarts(), [], [] as HeldCart[])
  const loadLines = useCartStore((s) => s.loadLines)
  const currentLines = useCartStore((s) => s.lines)
  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)
  const [pendingVoid, setPendingVoid] = React.useState<HeldCart | null>(null)
  const [pendingResume, setPendingResume] = React.useState<HeldCart | null>(null)
  const [busy, setBusy] = React.useState(false)

  const [requiresAuth, setRequiresAuth] = React.useState(true)
  React.useEffect(() => {
    let alive = true
    void readPosConfig().then((config) => {
      if (alive) setRequiresAuth(config.requireSupervisorForVoid)
    })
    return () => {
      alive = false
    }
  }, [])

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

  const voidHeldCart = async ({
    reasonCode,
    reasonNotes,
  }: {
    reasonCode: string
    reasonNotes: string
  }) => {
    if (!pendingVoid || !staffId) return

    setBusy(true)
    try {
      const shift = await getOpenShift()
      if (!shift) {
        toast.error('Tidak ada shift aktif — pembatalan harus terikat pada satu shift.')
        return
      }

      // Dibaca ULANG dari Dexie: daftar di layar bisa saja basi bila tab lain
      // sudah mengubah pesanan ini.
      const fresh = await getHeldCart(pendingVoid.id)
      if (!fresh) {
        toast.error('Pesanan sudah tidak ada.')
        setPendingVoid(null)
        return
      }

      await recordVoidLog({
        scope: 'HELD_ORDER',
        shiftId: shift.id,
        staffId,
        heldCartId: fresh.id,
        quantityBefore: fresh.items.reduce((sum, item) => sum + item.quantity, 0),
        quantityAfter: 0,
        valueAmountMinor: total(fresh),
        reasonCode,
        reasonNotes,
        cashierName: staffName ?? undefined,
        // Label pesanan menggantikan kode struk: pesanan tertahan tidak pernah
        // punya nomor struk, dan "Meja 4" jauh lebih berguna bagi supervisor
        // daripada UUID.
        heldCartLabel: fresh.label,
        // ⚠️ WAJIB UTUH. Pesanan tertahan tidak pernah ada di server; tanpa
        // snapshot ini, isi pesanan yang dibatalkan hilang selamanya dan audit
        // hanya melihat sebuah nominal tanpa penjelasan ([11 §M13.5]).
        itemsSnapshot: fresh.items.map((item) => ({
          product_id: item.product_id,
          product_name: item._product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      })

      // Baris hold dibuang SETELAH `void_logs` tertulis. Urutan sebaliknya
      // membuka jendela — sekecil apa pun — di mana pesanannya sudah lenyap
      // tetapi jejaknya belum ada.
      await removeHeldCart(fresh.id)

      toast.success('Pesanan dibatalkan. Struk pembatalan sedang dicetak.')
      setPendingVoid(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Pesanan Ditahan</h1>
      </div>

      <Banner tone="warning" title="Pesanan tertahan tidak dapat dihapus begitu saja">
        Pembatalannya dicatat sebagai pembatalan resmi beserta alasan dan isi pesanannya, lalu
        mencetak struk pembatalan. Bila pesanan masih mungkin dilanjutkan, biarkan saja tertahan.
      </Banner>

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

              {/* Bukan ikon tempat sampah: aksinya BUKAN penghapusan, dan
                  ikon yang berbohong tentang akibatnya adalah cara termudah
                  membuat kasir menekannya tanpa berpikir. */}
              <Button
                variant="neutral"
                size="lg"
                className="text-danger"
                aria-label={`Batalkan pesanan ${cart.label}`}
                onClick={() => setPendingVoid(cart)}
              >
                <Ban className="size-4" aria-hidden="true" />
                Batalkan
              </Button>
            </li>
          ))}
        </ul>
      )}

      <VoidSheet
        open={!!pendingVoid}
        title={`Batalkan pesanan ${pendingVoid?.label ?? ''}`}
        description={
          pendingVoid ? (
            <>
              <Num>{pendingVoid.items.length}</Num> item akan dibatalkan. Isinya dicatat utuh pada
              log pembatalan — pesanan tertahan tidak pernah ada di server, sehingga catatan itulah
              satu-satunya salinan yang tersisa.
            </>
          ) : null
        }
        valueMinor={pendingVoid ? total(pendingVoid) : 0}
        requiresAuth={requiresAuth}
        busy={busy}
        submitLabel="Ya, batalkan pesanan"
        onClose={() => setPendingVoid(null)}
        onSubmit={voidHeldCart}
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

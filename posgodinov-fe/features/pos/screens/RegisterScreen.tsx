'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Num } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { CartPanel } from '@/features/pos/components/CartPanel'
import { ProductTile } from '@/features/pos/components/ProductTile'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { holdCart } from '@/lib/db/repositories/held-cart.repo'
import { listCategories, listProducts } from '@/lib/db/repositories/master.repo'
import type { LocalProduct } from '@/lib/db/models'
import { newUuid } from '@/lib/uuid'
import { cn } from '@/lib/utils/cn'
import { HoldCartModal } from '@/features/pos/components/HoldCartModal'

const ALL = '__all__'
const UNCATEGORIZED = '__none__'

/**
 * P-05 Kasir Utama — docs/06 §3.3 & §4.2–4.4.
 *
 * Membaca **dari Dexie lewat `useLiveQuery`**, tidak pernah dari TanStack Query
 * (ADR-03). Jaringan bukan prasyarat render: selama IndexedDB berisi data,
 * layar tampil.
 */
export function RegisterScreen() {
  const [query, setQuery] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<string>(ALL)

  const products = useLiveQuery(() => listProducts(), [], [] as LocalProduct[])
  const categories = useLiveQuery(() => listCategories(), [], [])

  const lines = useCartStore((s) => s.lines)
  const addProduct = useCartStore((s) => s.addProduct)
  const clearCart = useCartStore((s) => s.clear)
  const staffId = usePosAuthStore((s) => s.staffId)
  const [holdOpen, setHoldOpen] = React.useState(false)

  const qtyByProduct = React.useMemo(
    () => new Map(lines.map((line) => [line.product_id, line.quantity])),
    [lines],
  )

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      if (needle && !product.name.toLowerCase().includes(needle)) return false
      if (activeCategory === ALL) return true
      if (activeCategory === UNCATEGORIZED) return product.category_id === null
      return product.category_id === activeCategory
    })
  }, [products, query, activeCategory])

  const countFor = React.useCallback(
    (categoryId: string) =>
      categoryId === ALL
        ? products.length
        : categoryId === UNCATEGORIZED
          ? products.filter((p) => p.category_id === null).length
          : products.filter((p) => p.category_id === categoryId).length,
    [products],
  )

  const hasUncategorized = products.some((p) => p.category_id === null)

  const onHold = () => {
    if (!staffId || !lines.length) return
    setHoldOpen(true)
  }

  const handleHoldConfirm = async (label: string) => {
    if (!staffId || !lines.length) return

    await holdCart({
      label: label || 'Tanpa nama',
      staffId,
      // ID item dibuat sekarang dan dipertahankan saat pesanan diambil kembali —
      // konsisten dengan aturan "UUID dibuat sekali" ([05 §1.5.1]).
      items: lines.map((line) => ({
        id: newUuid(),
        transaction_id: '',
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        _product_name: line.product_name,
      })),
    })

    clearCart()
    setHoldOpen(false)
    toast.success('Pesanan ditahan')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
          <Search className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
          <Input
            className="border-0 bg-transparent"
            placeholder="Cari produk…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari produk"
          />
        </div>

        {/* Tab TIDAK PERNAH membungkus ke baris kedua — pembungkusan menggeser
            grid dan memindahkan produk di bawah jari kasir ([06 §4.3]). */}
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2">
          <CategoryTab
            label="SEMUA"
            count={countFor(ALL)}
            active={activeCategory === ALL}
            onClick={() => setActiveCategory(ALL)}
          />
          {categories.map((category) => (
            <CategoryTab
              key={category.id}
              label={category.name}
              count={countFor(category.id)}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
          {/* Produk tanpa kategori masuk ke tab "Lainnya", ditempatkan terakhir. */}
          {hasUncategorized ? (
            <CategoryTab
              label="Lainnya"
              count={countFor(UNCATEGORIZED)}
              active={activeCategory === UNCATEGORIZED}
              onClick={() => setActiveCategory(UNCATEGORIZED)}
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {visible.length === 0 ? (
            <p className="p-6 text-center text-pos-sm text-fg-muted">
              {products.length === 0
                ? 'Master data belum tersedia di perangkat ini. Jalankan sinkronisasi dari menu Pengaturan.'
                : 'Tidak ada produk yang cocok.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  cartQty={qtyByProduct.get(product.id) ?? 0}
                  onAdd={() => addProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CartPanel onPay={() => posNavigate('payment')} onHold={onHold} />
      <HoldCartModal
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        onConfirm={handleHoldConfirm}
      />
    </div>
  )
}

function CategoryTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-touch shrink-0 flex-col items-center justify-center rounded-md border px-4',
        active
          ? 'border-accent bg-accent-subtle font-semibold text-accent'
          : 'border-border bg-surface text-fg-muted',
      )}
    >
      <span className="text-pos-sm">{label}</span>
      <Num className="text-pos-xs opacity-70">{count}</Num>
    </button>
  )
}

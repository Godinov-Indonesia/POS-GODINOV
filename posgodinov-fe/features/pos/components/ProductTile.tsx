'use client'

import * as React from 'react'

import { Money, Num } from '@/components/ui/money'
import type { LocalProduct } from '@/lib/db/models'
import { cn } from '@/lib/utils/cn'

/**
 * Warna latar deterministik dari nama produk — konsisten lintas perangkat &
 * sesi ([06 §4.2.3]). Deterministik itu penting: kasir menghafal posisi dan
 * warna, dan tile yang berganti warna tiap muat merusak hafalan itu.
 */
const TILE_TINTS = [
  'bg-accent-subtle text-accent',
  'bg-success-subtle text-success-text',
  'bg-warning-subtle text-warning-text',
  'bg-bg-muted text-fg-muted',
] as const

export function tileTint(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return TILE_TINTS[Math.abs(h) % TILE_TINTS.length]
}

/** "Kopi Susu Gula Aren" → "KS" · "Latte" → "LA" */
export const tileInitials = (name: string): string => {
  const words = name.trim().split(/\s+/)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

/**
 * `ProductTile` — docs/06 §4.2.
 *
 * ⚠️ **Tidak pernah dinonaktifkan.** Master data POS tidak memuat stok
 * ([03 §2.2]), sehingga tile tidak punya keadaan `disabled` dan UI kasir
 * dilarang menampilkan apa pun tentang ketersediaan stok.
 */
export function ProductTile({
  product,
  cartQty = 0,
  onAdd,
}: {
  product: LocalProduct
  cartQty?: number
  onAdd: (productId: string) => void
}) {
  // Tidak ada endpoint unggah gambar, jadi URL mati sangat mungkin terjadi —
  // fallback ke inisial wajib, bukan opsional ([06 §4.2.3]).
  const [imageFailed, setImageFailed] = React.useState(false)
  const showImage = !!product.image_url && !imageFailed

  return (
    <button
      type="button"
      onClick={() => onAdd(product.id)}
      className={cn(
        'relative flex h-[150px] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card',
        'hover:border-border-strong hover:shadow-raised',
        // Umpan balik tekan harus terasa seketika di bawah jari: tanpa transisi
        // masuk, transisi keluar 120ms. Bayangan TIDAK berubah — bayangan yang
        // berubah saat sentuh membaca sebagai "melayang", bukan "tertekan".
        'active:scale-[0.97] active:border-accent active:bg-accent-subtle',
        'transition-transform duration-[120ms] ease-out-pos active:duration-0',
      )}
    >
      <div className={cn('flex h-[72px] w-full items-center justify-center', tileTint(product.name))}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url ?? ''}
            alt=""
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-2xl font-semibold">{tileInitials(product.name)}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between px-3 py-2">
        <span className="line-clamp-2 text-pos-base font-medium text-fg">{product.name}</span>
        <Money minor={product.price} size="md" />
      </div>

      {cartQty > 0 ? (
        <span className="absolute right-2 top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-fg-inverse">
          <Num className="text-pos-xs font-semibold">{cartQty}</Num>
          <span className="sr-only">di keranjang</span>
        </span>
      ) : null}
    </button>
  )
}

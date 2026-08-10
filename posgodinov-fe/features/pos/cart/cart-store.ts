'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { CartLine } from '@/features/pos/cart/cart-math'
import type { LocalProduct } from '@/lib/db/models'

/**
 * Keranjang aktif — docs/05 §1.2.3.
 *
 * Store terpisah dari `sessionStore`/`posAuthStore` karena berubah puluhan kali
 * per menit; menggabungkannya memaksa render ulang yang tidak perlu pada
 * komponen yang datanya nyaris tidak pernah berubah.
 *
 * **Dipersistensi sebagai jaring pengaman** ([06 §5.1]). Pada tab peramban
 * biasa, `F5` dan `Ctrl+R` tetap dapat memuat ulang halaman; tanpa persistensi,
 * keranjang yang sedang diisi hilang begitu saja di depan pelanggan.
 *
 * Memakai `sessionStorage`, bukan Dexie seperti yang disebut [06 §5.1]:
 * keranjang bersifat per-tab (dua tab POS tidak boleh berbagi keranjang yang
 * sama), dan `sessionStorage` memberi batas itu secara bawaan sekaligus
 * menghindari migrasi skema Dexie untuk data yang belum menjadi transaksi.
 * Sasaran spesifikasinya — bertahan melewati reload — tetap terpenuhi.
 *
 * Persistensi adalah jaring pengaman, **bukan** pengganti "Tahan Pesanan"
 * (P-08) yang memang dimaksudkan untuk menyimpan pesanan secara sengaja.
 */
type CartState = {
  lines: CartLine[]
  customerName: string
  /** Diisi bila keranjang berasal dari pesanan tertahan, agar dapat dihapus setelah dibayar. */
  fromHeldCartId: string | null

  addProduct: (product: LocalProduct, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  increment: (productId: string, delta: number) => void
  setNote: (productId: string, note: string) => void
  removeLine: (productId: string) => void
  setCustomerName: (name: string) => void
  loadLines: (lines: CartLine[], heldCartId: string | null) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      customerName: '',
      fromHeldCartId: null,

      addProduct: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((line) => line.product_id === product.id)

          if (existing) {
            return {
              lines: state.lines.map((line) =>
                line.product_id === product.id
                  ? { ...line, quantity: line.quantity + quantity }
                  : line,
              ),
            }
          }

          return {
            lines: [
              ...state.lines,
              {
                product_id: product.id,
                product_name: product.name,
                // Snapshot harga: perubahan harga di katalog tidak boleh mengubah
                // nominal yang sudah ada di keranjang berjalan.
                unit_price: product.price,
                quantity,
              },
            ],
          }
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          // Kuantitas 0 berarti baris dibuang — tidak ada baris nol di keranjang.
          lines:
            quantity <= 0
              ? state.lines.filter((line) => line.product_id !== productId)
              : state.lines.map((line) =>
                  line.product_id === productId ? { ...line, quantity } : line,
                ),
        })),

      increment: (productId, delta) =>
        set((state) => ({
          lines: state.lines.flatMap((line) => {
            if (line.product_id !== productId) return [line]
            const next = line.quantity + delta
            return next <= 0 ? [] : [{ ...line, quantity: next }]
          }),
        })),

      setNote: (productId, note) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.product_id === productId ? { ...line, note } : line,
          ),
        })),

      removeLine: (productId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.product_id !== productId) })),

      setCustomerName: (name) => set({ customerName: name }),

      loadLines: (lines, heldCartId) =>
        set({ lines, fromHeldCartId: heldCartId, customerName: '' }),

      clear: () => set({ lines: [], customerName: '', fromHeldCartId: null }),
    }),
    {
      name: 'posgodinov.cart',
      // Per-tab: dua tab POS tidak boleh berbagi keranjang yang sama.
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

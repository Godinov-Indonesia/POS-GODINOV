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
/**
 * Hasil percobaan menurunkan kuantitas — **butir 5** ([11 §M13.4]).
 *
 * `blocked` bukan kegagalan; ia adalah perintah untuk membuka Void Sheet.
 */
export type DecrementAttempt =
  | { ok: true }
  | {
      ok: false
      reason: 'THRESHOLD'
      /** Berapa unit yang akan lenyap bila penurunan ini diteruskan. */
      totalDecrease: number
      threshold: number
    }

type CartState = {
  lines: CartLine[]
  customerName: string
  /** Diisi bila keranjang berasal dari pesanan tertahan, agar dapat dihapus setelah dibayar. */
  fromHeldCartId: string | null

  /**
   * Kuantitas TERTINGGI yang pernah dicapai setiap baris dalam keranjang ini.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * MENGAPA PUNCAK, BUKAN PENGHITUNG PENURUNAN
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Rancangan awal ([11 §M13.4]) menyebut "akumulator penurunan yang direset
   * saat baris ditambah". Bentuk itu dapat dipermainkan dengan sepele:
   * turunkan 5 → tambah 1 → turunkan 5 lagi. Akumulatornya kembali nol, dan
   * sembilan unit lenyap tanpa satu pun Void Sheet muncul.
   *
   * Puncak tidak dapat dipermainkan. Penurunan kumulatif SELALU
   * `puncak − kuantitas sekarang`, sehingga menambah barang kembali benar-benar
   * membatalkan penurunan alih-alih sekadar menghapus jejaknya. Dua aturan
   * rancangan — "sekaligus > 5" dan "akumulasi > 5" — juga melebur menjadi satu
   * pemeriksaan, dan satu pemeriksaan tidak dapat menyimpang dari dirinya
   * sendiri.
   */
  peakQuantity: Record<string, number>

  addProduct: (product: LocalProduct, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  increment: (productId: string, delta: number) => void
  setNote: (productId: string, note: string) => void
  removeLine: (productId: string) => void
  setCustomerName: (name: string) => void
  loadLines: (lines: CartLine[], heldCartId: string | null) => void
  clear: () => void

  /* ── Butir 5 ─────────────────────────────────────────────────────────── */

  /**
   * Memeriksa apakah menurunkan sebuah baris ke [nextQuantity] masih boleh
   * lewat stepper biasa.
   *
   * **Tidak mengubah apa pun.** Pemanggil yang menerima `ok: false` wajib
   * membuka Void Sheet, menulis `void_logs`, lalu memanggil [applyAudited].
   */
  canDecrementTo: (productId: string, nextQuantity: number, threshold: number) => DecrementAttempt

  /**
   * Menurunkan kuantitas SETELAH pembatalan tercatat.
   *
   * Dipisahkan dari [setQuantity] supaya jalur yang melewati ambang tidak
   * dapat dipakai tanpa sengaja: namanya sendiri menyatakan bahwa audit sudah
   * dilakukan.
   */
  applyAudited: (productId: string, nextQuantity: number) => void

  /** Penurunan kumulatif sebuah baris terhadap puncaknya. */
  decreaseOf: (productId: string) => number
}

/** Puncak hanya boleh naik — itulah yang membuatnya tidak dapat dipermainkan. */
const raisePeak = (
  peaks: Record<string, number>,
  productId: string,
  quantity: number,
): Record<string, number> =>
  quantity > (peaks[productId] ?? 0) ? { ...peaks, [productId]: quantity } : peaks

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      customerName: '',
      fromHeldCartId: null,
      peakQuantity: {},

      addProduct: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((line) => line.product_id === product.id)

          if (existing) {
            const next = existing.quantity + quantity
            return {
              lines: state.lines.map((line) =>
                line.product_id === product.id ? { ...line, quantity: next } : line,
              ),
              peakQuantity: raisePeak(state.peakQuantity, product.id, next),
            }
          }

          return {
            peakQuantity: raisePeak(state.peakQuantity, product.id, quantity),
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
          peakQuantity: raisePeak(state.peakQuantity, productId, Math.max(0, quantity)),
        })),

      increment: (productId, delta) =>
        set((state) => {
          const line = state.lines.find((l) => l.product_id === productId)
          const next = (line?.quantity ?? 0) + delta

          return {
            lines: state.lines.flatMap((l) => {
              if (l.product_id !== productId) return [l]
              return next <= 0 ? [] : [{ ...l, quantity: next }]
            }),
            peakQuantity: raisePeak(state.peakQuantity, productId, Math.max(0, next)),
          }
        }),

      setNote: (productId, note) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.product_id === productId ? { ...line, note } : line,
          ),
        })),

      removeLine: (productId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.product_id !== productId) })),

      canDecrementTo: (productId, nextQuantity, threshold) => {
        const state = get()
        const line = state.lines.find((l) => l.product_id === productId)
        if (!line) return { ok: true }

        const clamped = Math.max(0, nextQuantity)
        if (clamped >= line.quantity) return { ok: true } // menaikkan atau tetap

        const peak = state.peakQuantity[productId] ?? line.quantity
        const totalDecrease = peak - clamped

        if (totalDecrease > threshold) {
          return { ok: false, reason: 'THRESHOLD', totalDecrease, threshold }
        }
        return { ok: true }
      },

      applyAudited: (productId, nextQuantity) =>
        set((state) => ({
          lines:
            nextQuantity <= 0
              ? state.lines.filter((line) => line.product_id !== productId)
              : state.lines.map((line) =>
                  line.product_id === productId ? { ...line, quantity: nextQuantity } : line,
                ),
          // Puncak SENGAJA tidak diturunkan. Pembatalan yang sudah tercatat
          // tidak menghapus fakta bahwa barang itu pernah masuk keranjang, dan
          // menurunkan puncak akan memberi kasir satu jatah ambang baru secara
          // cuma-cuma pada baris yang sama.
          peakQuantity: state.peakQuantity,
        })),

      decreaseOf: (productId) => {
        const state = get()
        const line = state.lines.find((l) => l.product_id === productId)
        const peak = state.peakQuantity[productId] ?? line?.quantity ?? 0
        return Math.max(0, peak - (line?.quantity ?? 0))
      },

      setCustomerName: (name) => set({ customerName: name }),

      loadLines: (lines, heldCartId) =>
        set({
          lines,
          fromHeldCartId: heldCartId,
          customerName: '',
          // Pesanan yang diambil kembali memulai jatah ambangnya sendiri:
          // kuantitas yang tersimpan ADALAH puncaknya.
          peakQuantity: Object.fromEntries(lines.map((l) => [l.product_id, l.quantity])),
        }),

      clear: () => set({ lines: [], customerName: '', fromHeldCartId: null, peakQuantity: {} }),
    }),
    {
      name: 'posgodinov.cart',
      // Per-tab: dua tab POS tidak boleh berbagi keranjang yang sama.
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

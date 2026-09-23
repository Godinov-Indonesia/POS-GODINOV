/**
 * Aritmetika keranjang — docs/05 §1.8.1.
 *
 * Fungsi murni. Seluruh operasi beroperasi pada **integer sen** dan bersifat
 * **eksak** — tidak ada pembulatan di mana pun:
 *
 *   lineTotal = unitPrice(sen) × qty(int)   → eksak
 *   total     = Σ lineTotal                 → eksak
 *   change    = cashReceived − total        → eksak
 *
 * Komponen UI tidak pernah melakukan aritmetika uang; ia menerima hasil dari
 * sini ([06 §2.5 aturan 6]).
 */

export type CartLine = {
  product_id: string
  product_name: string
  /** sen — snapshot harga saat item ditambahkan, bukan harga terkini. */
  unit_price: number
  /** INT — produk tidak dapat dijual pecahan ([02 §2.13]). */
  quantity: number
  note?: string
}

export const lineTotal = (line: CartLine): number => line.unit_price * line.quantity

export const cartTotal = (lines: CartLine[]): number =>
  lines.reduce((sum, line) => sum + lineTotal(line), 0)

export const cartItemCount = (lines: CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0)

/** Negatif berarti uang yang diterima belum menutupi total. */
export const calculateChange = (cashReceivedMinor: number, totalMinor: number): number =>
  cashReceivedMinor - totalMinor

/**
 * Preset Fast-Cash — docs/06 §4.6.
 *
 * Menghasilkan nominal bulat di **atas** total yang wajar diserahkan pelanggan.
 * Pembulatan ke 5.000 / 10.000 / 50.000 mencerminkan pecahan Rupiah nyata;
 * preset yang lebih kecil dari total sengaja tidak pernah muncul karena ia
 * tidak dapat menyelesaikan pembayaran.
 */
export function fastCashPresets(totalMinor: number): number[] {
  if (totalMinor <= 0) return []

  const steps = [5_000_00, 10_000_00, 20_000_00, 50_000_00, 100_000_00]
  const presets = new Set<number>()

  // Uang pas selalu menjadi pilihan pertama — kasus paling sering.
  presets.add(totalMinor)

  for (const step of steps) {
    const rounded = Math.ceil(totalMinor / step) * step
    if (rounded > totalMinor) presets.add(rounded)
    if (presets.size >= 5) break
  }

  return [...presets].sort((a, b) => a - b).slice(0, 5)
}

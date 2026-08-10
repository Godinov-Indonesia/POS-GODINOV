/**
 * Model domain frontend — docs/05 §1.8.1.
 *
 * Berbeda dari `lib/types/api.ts` (bentuk kawat), tipe di sini adalah bentuk
 * yang dipakai state dan komponen. Satu perbedaan yang membedakan keduanya:
 *
 * > **Uang bertipe integer sen** (`*_minor`), bukan Rupiah desimal.
 *
 * Konversi terjadi di `lib/api/endpoints/*` saat masuk dan saat keluar (ADR-05).
 * Sufiks `_minor` bukan hiasan — ia membuat kesalahan satuan terlihat saat
 * membaca kode, bukan saat menghitung kembalian pelanggan.
 */

import type { Category, IsoDateTime, OutletId } from '@/lib/types/api'

export type RawMaterialView = {
  id: string
  outlet_id: OutletId
  name: string
  /** Base unit — seluruh stok dan resep memakai satuan ini. */
  unit: string
  package_unit: string | null
  quantity_per_package: number | null
  /** ⚠️ Boleh negatif — konsekuensi disengaja dari sinkronisasi POS offline. */
  stock: number
  /** HPP per base unit, dalam **sen**. */
  cost_per_unit_minor: number
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export type RecipeView = {
  id: string
  raw_material_id: string
  /** DECIMAL(12,4) dalam base unit, per 1 produk. Bukan uang — tidak dikonversi. */
  quantity: number
  raw_material?: RawMaterialView
}

export type ProductView = {
  id: string
  outlet_id: OutletId
  name: string
  /** Harga jual dalam **sen**. */
  price_minor: number
  image_url: string | null
  category_id: string | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
  recipes: RecipeView[]
  category: Category | null
}

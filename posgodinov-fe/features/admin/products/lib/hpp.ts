/**
 * Kalkulator HPP & margin — docs/05 §1.8.1, docs/06 §3.9.
 *
 * Fungsi murni: tidak menyentuh jaringan, state, maupun DOM. Seluruh nilai uang
 * masuk dan keluar sebagai **integer sen**.
 */

import type { RawMaterialView } from '@/lib/types/domain'

export type HppLine = {
  quantity: number
  raw_material?: Pick<RawMaterialView, 'cost_per_unit_minor'>
}

/**
 * ⚠️ **Jangan membulatkan per baris — akumulasi dulu, bulatkan sekali di akhir.**
 *
 * `product_recipes.quantity` bertipe DECIMAL(12,4), sehingga perkalian
 * `quantity × cost_per_unit_minor` tidak eksak. Yang berbahaya bukan galat
 * float pada langkah tunggal (nilainya jauh di dalam `MAX_SAFE_INTEGER`),
 * melainkan **pembulatan berulang** — dan itulah yang dihindari aturan ini.
 *
 * Baris tanpa `raw_material` (mis. resep yatim karena bahan bakunya dihapus)
 * dilewati, meniru perilaku backend yang juga melewatinya secara diam-diam.
 */
export function calculateHpp(lines: HppLine[]): number {
  const raw = lines.reduce(
    (sum, line) => sum + line.quantity * (line.raw_material?.cost_per_unit_minor ?? 0),
    0,
  )
  return Math.round(raw) // half-up ke sen, hanya di langkah terakhir
}

export type MarginSummary = {
  /** sen */
  hppMinor: number
  /** sen */
  priceMinor: number
  /** sen — bisa negatif bila harga jual di bawah HPP */
  marginMinor: number
  /** Persen terhadap harga jual. `null` bila harga jual 0 (tidak terdefinisi). */
  marginPercent: number | null
}

export function calculateMargin(lines: HppLine[], priceMinor: number): MarginSummary {
  const hppMinor = calculateHpp(lines)
  const marginMinor = priceMinor - hppMinor

  return {
    hppMinor,
    priceMinor,
    marginMinor,
    // Pembagian dengan 0 menghasilkan Infinity, yang akan dirender sebagai
    // "∞%" — lebih jujur menyatakan bahwa margin belum terdefinisi.
    marginPercent: priceMinor === 0 ? null : (marginMinor / priceMinor) * 100,
  }
}

/** Bahan baku ganda dilarang backend maupun unique constraint DB ([02 §2.6]). */
export function findDuplicateRawMaterialIds(
  recipes: { raw_material_id: string }[],
): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const recipe of recipes) {
    if (!recipe.raw_material_id) continue
    if (seen.has(recipe.raw_material_id)) duplicates.add(recipe.raw_material_id)
    seen.add(recipe.raw_material_id)
  }

  return [...duplicates]
}

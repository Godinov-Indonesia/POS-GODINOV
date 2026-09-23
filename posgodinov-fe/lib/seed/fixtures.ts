/**
 * Fixture data uji E2E — Godinov Coffee & Eatery, Sudirman.
 *
 * **Satu sumber kebenaran** untuk dua muara: `seed-dexie.ts` (POS offline) dan
 * `seed-api.ts` (backend). Menduplikasi angka di dua tempat adalah cara
 * termudah membuat dua lingkungan uji yang diam-diam berbeda.
 *
 * ATURAN YANG DIPATUHI BERKAS INI
 * -------------------------------
 * - **Seluruh uang bertipe integer sen** (ADR-05, [05 §1.8.1]). Kolom `Rupiah`
 *   pada komentar hanya bantuan baca; angka yang dipakai kode adalah `*_minor`.
 * - **UUID bersifat tetap**, bukan dibangkitkan acak. Seeder harus idempotent:
 *   menjalankannya dua kali memperbarui baris yang sama, bukan menggandakannya.
 *   Ini juga membuat kegagalan uji dapat dirujuk dengan ID yang stabil.
 * - Produk **tidak** membawa stok. Master data POS memang tidak memuatnya
 *   ([03 §2.2]); stok hanya hidup di sisi Admin.
 */

import { toMinor } from '@/lib/money'

/* ── Identitas tenant ─────────────────────────────────────────────────────── */

export const SEED_BUSINESS = {
  /** `businesses.id` — VARCHAR(8). */
  id: 'GODINOV1',
  serial_business: 'GODBU100826',
  name: 'Godinov Digital',
  owner_name: 'Muhamad Rifki Firdaus',
  email: 'owner@godinov.id',
} as const

export const SEED_OUTLET = {
  /** `outlets.id` — VARCHAR(6). */
  id: 'GDN001',
  serial_tenant: 'GODBU100826001',
  name: 'Godinov Coffee & Eatery - Sudirman',
  address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
} as const

/* ── Staff / kasir ────────────────────────────────────────────────────────── */

export type SeedStaff = {
  id: string
  staff_identifier: string
  name: string
  /** PIN teks polos — **hanya** untuk fixture uji, di-hash saat seeding. */
  pin: string
}

/**
 * ⚠️ PIN di sini sengaja terbaca jelas: ini berkas fixture untuk lingkungan
 * uji, dan penguji perlu tahu PIN-nya. **Jangan** memakai berkas ini untuk
 * membuat akun produksi. Hash bcrypt dibuat saat seeding, bukan ditanam di
 * sini, supaya cost-nya selalu cocok dengan yang dipakai backend.
 */
export const SEED_STAFFS: SeedStaff[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    staff_identifier: 'kasir01',
    name: 'Siti Aminah',
    pin: '1234',
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    staff_identifier: 'kasir02',
    name: 'Andi Pratama',
    pin: '5678',
  },
]

/* ── Kategori ─────────────────────────────────────────────────────────────── */

export type SeedCategory = { id: string; name: string; description: string }

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: '22222222-2222-4222-8222-000000000001',
    name: 'Kopi & Espresso',
    description: 'Seduhan berbasis biji kopi',
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    name: 'Non-Kopi & Tea',
    description: 'Matcha, teh, dan minuman tanpa kopi',
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    name: 'Makanan Utama (Eatery)',
    description: 'Hidangan berat',
  },
  {
    id: '22222222-2222-4222-8222-000000000004',
    name: 'Pastry & Bakery',
    description: 'Roti dan pastry',
  },
]

/* ── Bahan baku ───────────────────────────────────────────────────────────── */

export type SeedRawMaterial = {
  id: string
  name: string
  /** Base unit — seluruh stok dan resep memakai satuan ini. */
  unit: string
  package_unit: string | null
  quantity_per_package: number | null
  /** Dalam base unit. */
  stock: number
  /** HPP per base unit, **dalam sen**. */
  cost_per_unit_minor: number
}

/**
 * `cost_per_unit` ditulis lewat `toMinor()` alih-alih angka sen mentah supaya
 * nilai Rupiah-nya tetap terbaca dan tidak ada kesempatan salah menghitung
 * ×100 secara manual — termasuk untuk harga pecahan seperti Rp 18,5.
 */
export const SEED_RAW_MATERIALS: SeedRawMaterial[] = [
  {
    id: '33333333-3333-4333-8333-000000000001',
    name: 'Biji Kopi Arabika',
    unit: 'gram',
    package_unit: 'kg',
    quantity_per_package: 1000,
    stock: 5_000,
    cost_per_unit_minor: toMinor(180), // Rp 180 / gram
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    name: 'Susu UHT Full Cream',
    unit: 'ml',
    package_unit: 'kotak',
    quantity_per_package: 1000,
    stock: 12_000,
    cost_per_unit_minor: toMinor(18.5), // Rp 18,5 / ml → 1.850 sen
  },
  {
    id: '33333333-3333-4333-8333-000000000003',
    name: 'Gula Aren Cair',
    unit: 'ml',
    package_unit: null,
    quantity_per_package: null,
    stock: 3_000,
    cost_per_unit_minor: toMinor(30), // Rp 30 / ml
  },
  {
    id: '33333333-3333-4333-8333-000000000004',
    name: 'Bubuk Matcha Premium',
    unit: 'gram',
    package_unit: null,
    quantity_per_package: null,
    stock: 1_000,
    cost_per_unit_minor: toMinor(250), // Rp 250 / gram
  },
  {
    id: '33333333-3333-4333-8333-000000000005',
    name: 'Cup Plastik 16oz',
    unit: 'pcs',
    package_unit: 'dus',
    quantity_per_package: 50,
    stock: 500,
    cost_per_unit_minor: toMinor(450), // Rp 450 / pcs
  },
  {
    id: '33333333-3333-4333-8333-000000000006',
    name: 'Croissant Frozen',
    unit: 'pcs',
    package_unit: null,
    quantity_per_package: null,
    stock: 100,
    cost_per_unit_minor: toMinor(8_000), // Rp 8.000 / pcs
  },
  {
    id: '33333333-3333-4333-8333-000000000007',
    name: 'Daging Ayam Fillet',
    unit: 'gram',
    package_unit: null,
    quantity_per_package: null,
    stock: 4_000,
    cost_per_unit_minor: toMinor(50), // Rp 50 / gram
  },
  {
    id: '33333333-3333-4333-8333-000000000008',
    name: 'Rice/Beras',
    unit: 'gram',
    package_unit: 'karung',
    quantity_per_package: 5_000,
    stock: 10_000,
    cost_per_unit_minor: toMinor(14), // Rp 14 / gram
  },
]

/* ── Produk & resep (BOM) ─────────────────────────────────────────────────── */

export type SeedRecipe = { raw_material_id: string; quantity: number }

export type SeedProduct = {
  id: string
  name: string
  /** Harga jual **dalam sen**. */
  price_minor: number
  category_id: string
  image_url: string | null
  /**
   * ⚠️ Hanya dipakai muara **API/Admin**. Master data POS tidak memuat resep
   * ([03 §2.2]), sehingga `seed-dexie.ts` mengabaikan field ini.
   */
  recipes: SeedRecipe[]
}

const RM = {
  kopi: SEED_RAW_MATERIALS[0].id,
  susu: SEED_RAW_MATERIALS[1].id,
  gulaAren: SEED_RAW_MATERIALS[2].id,
  matcha: SEED_RAW_MATERIALS[3].id,
  cup: SEED_RAW_MATERIALS[4].id,
  croissant: SEED_RAW_MATERIALS[5].id,
  ayam: SEED_RAW_MATERIALS[6].id,
  beras: SEED_RAW_MATERIALS[7].id,
} as const

const CAT = {
  kopi: SEED_CATEGORIES[0].id,
  nonKopi: SEED_CATEGORIES[1].id,
  makanan: SEED_CATEGORIES[2].id,
  pastry: SEED_CATEGORIES[3].id,
} as const

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: '44444444-4444-4444-8444-000000000001',
    name: 'Kopi Susu Gula Aren',
    price_minor: toMinor(22_000),
    category_id: CAT.kopi,
    image_url: null,
    // HPP = 18×180 + 120×18,5 + 30×30 + 1×450 = Rp 6.810 · margin 69,05%
    recipes: [
      { raw_material_id: RM.kopi, quantity: 18 },
      { raw_material_id: RM.susu, quantity: 120 },
      { raw_material_id: RM.gulaAren, quantity: 30 },
      { raw_material_id: RM.cup, quantity: 1 },
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000002',
    name: 'Matcha Latte Ice',
    price_minor: toMinor(26_000),
    category_id: CAT.nonKopi,
    image_url: null,
    // HPP = 20×250 + 150×18,5 + 1×450 = Rp 8.225 · margin 68,37%
    recipes: [
      { raw_material_id: RM.matcha, quantity: 20 },
      { raw_material_id: RM.susu, quantity: 150 },
      { raw_material_id: RM.cup, quantity: 1 },
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000003',
    name: 'Americano Hot',
    price_minor: toMinor(18_000),
    category_id: CAT.kopi,
    image_url: null,
    // HPP = 18×180 + 1×450 = Rp 3.690 · margin 79,50%
    recipes: [
      { raw_material_id: RM.kopi, quantity: 18 },
      { raw_material_id: RM.cup, quantity: 1 },
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000004',
    name: 'Croissant Butter',
    price_minor: toMinor(18_000),
    category_id: CAT.pastry,
    image_url: null,
    // HPP = 1×8.000 = Rp 8.000 · margin 55,56%
    recipes: [{ raw_material_id: RM.croissant, quantity: 1 }],
  },
  {
    id: '44444444-4444-4444-8444-000000000005',
    name: 'Nasi Ayam Geprek',
    price_minor: toMinor(28_000),
    category_id: CAT.makanan,
    image_url: null,
    // HPP = 150×50 + 200×14 = Rp 10.300 · margin 63,21%
    recipes: [
      { raw_material_id: RM.ayam, quantity: 150 },
      { raw_material_id: RM.beras, quantity: 200 },
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000006',
    name: 'Es Teh Manis',
    price_minor: toMinor(8_000),
    category_id: CAT.nonKopi,
    image_url: null,
    // HPP = 1×450 = Rp 450 · margin 94,38%
    recipes: [{ raw_material_id: RM.cup, quantity: 1 }],
  },
]

/* ── Ringkasan untuk verifikasi cepat ─────────────────────────────────────── */

export const SEED_SUMMARY = {
  categories: SEED_CATEGORIES.length,
  rawMaterials: SEED_RAW_MATERIALS.length,
  products: SEED_PRODUCTS.length,
  staffs: SEED_STAFFS.length,
} as const

/**
 * HPP tiap produk dihitung dari fixture, bukan ditulis tangan.
 *
 * Dipakai `docs/uat.md` dan skenario uji margin. Mengikuti aturan [05 §1.8.1]:
 * akumulasi dulu, bulatkan **sekali** di akhir.
 */
export function seedHppMinor(product: SeedProduct): number {
  const costById = new Map(SEED_RAW_MATERIALS.map((m) => [m.id, m.cost_per_unit_minor]))
  const raw = product.recipes.reduce(
    (sum, recipe) => sum + recipe.quantity * (costById.get(recipe.raw_material_id) ?? 0),
    0,
  )
  return Math.round(raw)
}

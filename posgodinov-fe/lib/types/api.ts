/**
 * DTO transport backend POS Godinov.
 *
 * Sumber kebenaran: docs/03-api-specifications.md (diturunkan dari struct Go).
 *
 * TIGA ATURAN YANG MENGIKAT SELURUH BERKAS INI
 * --------------------------------------------
 * 1. Seluruh field uang di sini bertipe **Rupiah desimal** (bentuk kawat/wire),
 *    BUKAN integer sen. Konversi ke sen terjadi di batas API lewat `toMinor()`
 *    ([05 §1.8.1]). Field bertipe sen hanya hidup di `lib/db/models.ts`.
 * 2. Setiap koleksi dapat datang sebagai `null`, bukan `[]` ([03 §2.2],
 *    [05 §3.1]). Tipe di sini merefleksikan kenyataan itu apa adanya
 *    (`T[] | null`); normalisasi dilakukan `requestList()` / `?? []`.
 * 3. Tipe ini adalah bentuk KAWAT, bukan model domain. Jangan menambahkan
 *    field turunan atau field lokal berprefiks `_` ke dalamnya.
 */

import type { PaymentMethod } from '@/lib/constants/payment'

/* ═══════════════════════ 0. Konvensi global ([03 §0]) ═══════════════════════ */

/** Bentuk A — amplop standar, dipakai 35 dari 38 endpoint. */
export type ApiEnvelope<T> = {
  status: 'success'
  message: string
  data: T
}

/**
 * Bentuk error untuk seluruh endpoint. `status` bernilai `"fail"` untuk 4xx dan
 * `"error"` untuk 5xx. Kunci di dalam `errors` bervariasi: `server`, `password`,
 * `credentials`, `token`, `rate_limit`, atau `error`.
 */
export type ApiErrorBody = {
  status: 'fail' | 'error'
  message: string
  errors?: Record<string, string>
}

/** Kelompok endpoint menentukan jenis token yang wajib dikirim ([03 §0]). */
export type TokenKind = 'access' | 'device'

/** `outlets.id` — VARCHAR(6), mis. `"A3K9P1"`. Bukan UUID. */
export type OutletId = string
/** `businesses.id` — VARCHAR(8), mis. `"K7M2P9X4"`. Bukan UUID. */
export type BusinessId = string
/** ISO-8601 dengan zona waktu. */
export type IsoDateTime = string

/* ═══════════════════ 1. Auth & Session (Business Owner) ═══════════════════ */

export type Business = {
  id: BusinessId
  /** Dibutuhkan untuk device binding POS; tidak dapat diambil lewat endpoint lain. */
  serial_business: string
  email: string
  name: string
  owner_name: string
  created_at: IsoDateTime
}

/** `POST /v1/auth/business/register` ([03 §1.1]) — rate limit 10 req/menit per IP. */
export type RegisterRequest = {
  name: string
  owner_name: string
  email: string
  password: string
  confirmation_password: string
}

/** `POST /v1/auth/business/login` ([03 §1.2]) — tanpa rate limit di backend. */
export type LoginRequest = {
  email: string
  password: string
}

/**
 * Response register (`201`) dan login (`200`).
 * ⚠️ Bentuk B — **tanpa amplop**. Wajib diminta lewat `request<T>({ raw: true })`.
 */
export type AuthResponse = {
  business: Business
  access_token: string
  refresh_token: string
}

/** `POST /v1/auth/business/refresh` ([03 §1.3]) — token dikirim di body, bukan header. */
export type RefreshRequest = {
  refresh_token: string
}

/**
 * ⚠️ Bentuk B — tanpa amplop. Refresh token **tidak dirotasi**, sehingga
 * `refreshTokenExpiry` tidak ikut diperpanjang ([05 §1.4.1]).
 */
export type RefreshResponse = {
  access_token: string
}

/* ═══════════════════════ 2. POS Device Auth & Sync ═══════════════════════ */

/** `POST /v1/auth/device/bind` ([03 §2.1]) — `password` adalah password Business Owner. */
export type DeviceBindRequest = {
  serial_business: string
  /** `outlets.serial_tenant`, bukan `outlets.id`. */
  serial_outlet: string
  password: string
}

/** Beramplop. Token berlaku ~10 tahun dan **tidak dapat dicabut**. */
export type DeviceBindResponse = {
  device_token: string
}

/** ⚠️ `pin_hash` bcrypt memang dikirim ke perangkat — login kasir divalidasi lokal. */
export type MasterStaff = {
  id: string
  staff_identifier: string
  name: string
  pin_hash: string
}

export type MasterCategory = {
  id: string
  name: string
  description: string | null
}

/**
 * ⚠️ TIDAK ADA `stock` dan TIDAK ADA `recipes` — resep sengaja dihapus dari
 * payload klien ([03 §2.2]). UI kasir dilarang menampilkan ketersediaan stok.
 * `price` di sini masih Rupiah desimal.
 */
export type MasterProduct = {
  id: string
  name: string
  price: number
  image_url: string | null
  category_id: string | null
}

/** `GET /v1/pos/sync/master-data` ([03 §2.2]) — setiap array terkonfirmasi bisa `null`. */
export type MasterDataResponse = {
  staffs: MasterStaff[] | null
  categories: MasterCategory[] | null
  products: MasterProduct[] | null
}

/* ── Sync up (`POST /v1/pos/sync`, [03 §2.3]) ─────────────────────────────── */

export type ShiftStatus = 'OPEN' | 'CLOSED'
export type TransactionStatus = 'COMPLETED' | 'CANCELLED'

/**
 * `id` WAJIB diisi klien (UUID v4) — server tidak membuatkan. Inilah dasar
 * idempotensi. `business_id` / `outlet_id` tidak perlu dikirim; backend
 * menimpanya paksa dari device token.
 */
export type ShiftPayload = {
  id: string
  staff_id: string
  opening_balance: number
  closing_balance: number
  /** Dihitung klien — server tidak menghitung ulang dari transaksi ([02 §2.11]). */
  expected_balance: number
  /** Dihitung klien. */
  discrepancy: number
  status: ShiftStatus
  client_opened_at: IsoDateTime
  client_closed_at: IsoDateTime | null
}

export type TransactionItemPayload = {
  id: string
  transaction_id: string
  product_id: string
  /** INT — produk tidak dapat dijual pecahan ([02 §2.13]). */
  quantity: number
  /** Snapshot harga saat transaksi, bukan harga terkini. */
  unit_price: number
}

export type TransactionPayload = {
  id: string
  /** FK ke `shifts(id)` — shift wajib ada pada payload yang sama atau sebelumnya. */
  shift_id: string
  /** Kolom NOT NULL — kirim string kosong bila tidak ada. */
  customer_name: string
  total_amount: number
  payment_method: PaymentMethod
  status: TransactionStatus
  cancel_notes: string
  client_created_at: IsoDateTime
  items: TransactionItemPayload[]
}

export type WastePayload = {
  id: string
  staff_id: string
  product_id: string
  quantity: number
  reason: string
  client_created_at: IsoDateTime
}

/**
 * ⚠️ Kunci `wastes`, **bukan** `product_wastes` — CLIENTS.md keliru soal ini.
 * Nama yang salah menyebabkan data waste diabaikan tanpa error apa pun.
 * Urutan pemrosesan server: shifts → transactions → wastes.
 */
export type SyncUpRequest = {
  shifts: ShiftPayload[]
  transactions: TransactionPayload[]
  wastes: WastePayload[]
}

/**
 * ⚠️ Endpoint tetap mengembalikan `200` walau sebagian gagal. **Jangan
 * memperlakukan `200` sebagai "semua berhasil"** ([03 §2.3]).
 *
 * Hanya transaksi yang dilacak per-ID. Shift dan waste yang gagal dilewati
 * secara diam-diam; `*_synced` yang lebih kecil dari jumlah terkirim adalah
 * satu-satunya petunjuk.
 */
export type SyncUpResponse = {
  shifts_synced: number
  transactions_synced: number
  wastes_synced: number
  /** Terkonfirmasi bisa `null` — normalisasi `?? []` wajib ([05 §3.1]). */
  failed_transactions: string[] | null
}

/** `GET /v1/pos/transactions` ([03 §2.4]) — hard-coded 50 terbaru, tanpa paginasi. */
export type PosTransaction = {
  id: string
  shift_id: string
  outlet_id: OutletId
  business_id: BusinessId
  customer_name: string
  total_amount: number
  payment_method: string
  status: TransactionStatus
  cancel_notes: string
  client_created_at: IsoDateTime
  /** Waktu tiba di server — laporan difilter dengan kolom ini, bukan `client_created_at`. */
  created_at: IsoDateTime
  items: TransactionItemPayload[] | null
}

/* ═══════════════════════ 3. Outlet Management ═══════════════════════ */

export type Outlet = {
  id: OutletId
  business_id: BusinessId
  /** `serial_business` + nomor urut 3 digit. Dibutuhkan teknisi untuk device binding. */
  serial_tenant: string
  name: string
  address: string
  created_at: IsoDateTime
}

/** `POST /v1/business/outlets` ([03 §3.1]). Tidak ada `PUT` maupun `DELETE`. */
export type CreateOutletRequest = {
  name: string
  address?: string
}

/* ═══════════════════════ 4. Staff Management ═══════════════════════ */

/** Selalu `"CASHIER"` — tidak dapat ditentukan saat pembuatan ([03 §4.1]). */
export type StaffRole = 'CASHIER'

export type Staff = {
  id: string
  outlet_id: OutletId
  staff_identifier: string
  email: string | null
  name: string
  role: StaffRole
  is_active: boolean
  created_at: IsoDateTime
}

/** ⚠️ `outlet_id` dikirim di dalam **body**, bukan di path ([03 §4.1]). */
export type CreateStaffRequest = {
  outlet_id: OutletId
  /** Unik per outlet. */
  staff_identifier: string
  name: string
  /** Panjang 4-6 karakter; tidak wajib angka. Di-hash bcrypt oleh backend. */
  pin: string
  email?: string
}

/**
 * Update parsial — field kosong diabaikan.
 * ⚠️ **PIN tidak dapat diubah**; tidak ada endpoint reset PIN sama sekali.
 */
export type UpdateStaffRequest = {
  staff_identifier?: string
  name?: string
  /** Kirim `null` untuk mengosongkan; hilangkan field untuk membiarkan. */
  email?: string | null
  /** Hilangkan field untuk membiarkan. */
  is_active?: boolean
}

/* ═══════════════════════ 5. Product Categories ═══════════════════════ */

/**
 * Kategori bersifat **per-outlet**, bukan per-bisnis ([02 §2.4]).
 * ⚠️ Tidak ada `PUT` maupun `DELETE` — UI wajib menyembunyikan tombol
 * edit/hapus kategori ([05 §3.5]).
 */
export type Category = {
  id: string
  outlet_id: OutletId
  name: string
  description: string | null
  created_at: IsoDateTime
}

export type CreateCategoryRequest = {
  name: string
  description?: string
}

/** Endpoint `/bulk` menerima **array telanjang**, bukan objek berpembungkus. */
export type CreateCategoryBulkRequest = CreateCategoryRequest[]

/* ═══════════════════════ 6. Products & BOM ═══════════════════════ */

export type ProductRecipe = {
  id: string
  product_id: string
  raw_material_id: string
  /** DECIMAL(12,4) dalam **base unit** bahan baku, per 1 produk. */
  quantity: number
  created_at: IsoDateTime
  /** Ter-preload pada `GET .../products` — sumber data kalkulator HPP. */
  raw_material?: RawMaterial
}

export type Product = {
  id: string
  outlet_id: OutletId
  name: string
  /** Rupiah desimal. Konversi ke sen lewat `toMinor()` di batas API. */
  price: number
  image_url: string | null
  category_id: string | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
  recipes: ProductRecipe[] | null
  category?: Category | null
}

export type RecipeInput = {
  raw_material_id: string
  /** Harus > 0, dalam base unit, dan tidak boleh ada bahan baku ganda. */
  quantity: number
}

/** ⚠️ Tidak ada endpoint upload file — `image_url` hanya berupa URL ([02 §2.5]). */
export type CreateProductRequest = {
  name: string
  price: number
  image_url?: string
  category_id?: string | null
  recipes?: RecipeInput[]
}

/**
 * Semantik update yang wajib dipatuhi ([03 §6.4]):
 * - `price` diperbarui jika ≥ 0 — mengirim `0` benar-benar menetapkan harga 0.
 * - `image_url` tidak dapat dikosongkan.
 * - `category_id` **selalu ditimpa**, termasuk dengan `null`.
 * - `recipes` adalah **penggantian total**; menghilangkannya menghapus seluruh
 *   resep. Frontend wajib selalu mengirim array `recipes` yang lengkap.
 */
export type UpdateProductRequest = CreateProductRequest

/* ═══════════════════════ 7. Raw Materials (Inventory) ═══════════════════════ */

export type RawMaterial = {
  id: string
  outlet_id: OutletId
  name: string
  /** **Base unit** — seluruh stok dan resep memakai satuan ini. */
  unit: string
  /** Satuan kemasan untuk opname, mis. `"kotak"`. */
  package_unit: string | null
  /** Isi per kemasan. Wajib bila ingin opname dengan `package_unit`. */
  quantity_per_package: number | null
  /** ⚠️ **Boleh bernilai negatif** — konsekuensi disengaja dari sync POS offline. */
  stock: number
  /** HPP per base unit — moving average, dihitung ulang saat restock. */
  cost_per_unit: number
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export type CreateRawMaterialRequest = {
  name: string
  unit: string
  package_unit?: string
  quantity_per_package?: number
  /** Stok awal dalam base unit. Default `0`. */
  stock?: number
  cost_per_unit?: number
}

/**
 * ⚠️ `stock` sengaja tidak ada di payload update ([03 §7.4]). Stok hanya
 * berubah lewat restock, waste, opname, atau sync POS. Jangan menyediakan
 * field "edit stok" di UI.
 */
export type UpdateRawMaterialRequest = {
  name?: string
  unit?: string
  package_unit?: string
  quantity_per_package?: number
  cost_per_unit?: number
}

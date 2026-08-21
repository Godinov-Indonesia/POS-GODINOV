/**
 * Model lokal modul Opname — **butir 3 & 4** ([11 §M16.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BERKAS TERPISAH, BUKAN BAGIAN DARI `lib/db/models.ts`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Menaruh model opname bersama model kasir akan membuat satu impor tak sengaja
 * membawa seluruh tipe transaksi ke dalam bundle gudang — dan sebaliknya. Batas
 * yang hanya berupa kesepakatan akan dilanggar oleh orang pertama yang menekan
 * auto-import.
 *
 * ⚠️ **TIDAK ADA satu pun field ekspektasi selama status `DRAFT`.**
 * Lihat [OpnameLine]: `system_stock`, `difference`, dan `fraud_flag` hidup di
 * [OpnameResultLine] yang hanya lahir SETELAH penguncian, dari respons server.
 */

import type { IsoDateTime } from '@/lib/types/api'

/** Transisi SATU ARAH — tidak ada jalan kembali dari `LOCKED` ke `DRAFT`. */
export type OpnameStatus = 'DRAFT' | 'LOCKED' | 'APPROVED' | 'REJECTED'

export type OpnameScope = 'FULL' | 'CATEGORY' | 'PARTIAL'

/** Satuan yang dipakai petugas saat menghitung (migrasi `000014`). */
export type OpnameInputType = 'base_unit' | 'package_unit'

/**
 * Sesi opname yang tersimpan di perangkat gudang.
 *
 * Opname gudang sering berlangsung di area tanpa sinyal — ruang pendingin,
 * gudang belakang, lantai bawah. Sesi hidup di Dexie lebih dulu dan menyusul ke
 * server, sama seperti transaksi di jalur kasir.
 */
export type OpnameSession = {
  /** UUID v4 dibuat KLIEN (aturan R2) — dasar idempotensi. */
  id: string
  status: OpnameStatus
  scope: OpnameScope
  notes: string
  /** Staff yang menghitung. */
  counted_by: string
  counted_by_name: string
  client_created_at: IsoDateTime
  /** Diisi dari respons `POST /lock`, bukan dihitung klien. */
  locked_at: IsoDateTime | null

  /** `0` mengantre · `1` tersinkron. */
  _synced: 0 | 1
  _syncError: string | null
}

/**
 * Satu baris hitungan — **fase DRAFT**.
 *
 * ⛔ Perhatikan apa yang tidak ada di sini: `system_stock`, `difference`,
 * `difference_value`, `fraud_flag`. Ketiadaannya adalah butir 3 dalam bentuk
 * tipe — tidak ada tempat untuk menyimpannya, sehingga tidak ada cara
 * menampilkannya, bahkan bila server keliru mengirimkannya.
 */
export type OpnameLine = {
  /** `${session_id}:${raw_material_id}` — kunci majemuk Dexie. */
  key: string
  session_id: string
  raw_material_id: string

  /** Angka yang diketik petugas, dalam satuan [input_type]. */
  counted: number
  input_type: OpnameInputType
  notes: string

  /** Kapan petugas terakhir menyentuh baris ini — dasar urutan "belum dihitung". */
  counted_at: IsoDateTime | null
}

/**
 * Baris hasil — **fase LOCKED**.
 *
 * Lahir HANYA dari respons `POST /lock`, tidak pernah dihitung di klien.
 * Menghitungnya sendiri di perangkat berarti perangkat itu harus memegang stok
 * sistem, dan butir 3 runtuh sebelum satu pixel pun digambar.
 */
export type OpnameResultLine = {
  key: string
  session_id: string
  raw_material_id: string
  raw_material_name: string
  unit: string

  actual_stock: number
  system_stock: number
  difference: number
  difference_value: number
  fraud_flag: boolean
}

/**
 * Katalog bahan baku milik modul opname.
 *
 * ⚠️ **Tanpa kolom stok**, dan itu bukan kelalaian: payload master data memang
 * tidak mengirimkannya ([03 §2.2]). Menambahkan kolom `stock` di sini akan
 * membuat seseorang mengisinya "dari endpoint lain" suatu hari, dan seluruh
 * Blind Opname selesai dalam satu commit.
 */
export type OpnameMaterial = {
  id: string
  name: string
  unit: string
  package_unit: string | null
  quantity_per_package: number | null
  _syncedAt: IsoDateTime
}

/** Staff yang boleh masuk modul opname. */
export type OpnameStaff = {
  id: string
  staff_identifier: string
  name: string
  /** bcrypt — dibandingkan lokal, sama seperti jalur kasir ([05 §1.4.5]). */
  pin_hash: string
  role: string
  permissions: string[] | null
  _syncedAt: IsoDateTime
}

export type OpnameMetaKey =
  | 'device.token'
  | 'device.id'
  | 'device.outletLabel'
  | 'master.lastSyncAt'
  | 'session.active'

export type OpnameMetaRow = {
  key: OpnameMetaKey | string
  value: unknown
  updated_at: IsoDateTime
}

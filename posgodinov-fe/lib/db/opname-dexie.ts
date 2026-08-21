/**
 * Basis data modul Opname — **butir 4** ([11 §M16.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE BERBEDA, BUKAN TABEL BERBEDA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Namanya `posgodinov-opname`, bukan `posgodinov`. Itu satu kata yang menjadi
 * penegakan paling kuat di seluruh fase ini:
 *
 *   · Sesi kasir dan sesi opname **secara struktural tidak dapat saling
 *     melihat**. Bukan karena ada pemeriksaan yang melarangnya, melainkan
 *     karena keduanya berada di IndexedDB yang berbeda — bahkan bila seseorang
 *     salah menulis impor dan aturan lint gagal menangkapnya.
 *   · Petugas gudang yang login di `/opname` tidak ikut login di `/pos`, dan
 *     sebaliknya. Tidak ada kode yang perlu memastikannya.
 *   · Menghapus data opname tidak menyentuh satu pun transaksi kasir.
 *
 * Verifikasinya sederhana dan tidak dapat diperdebatkan: DevTools → Application
 * → IndexedDB menampilkan DUA database (DoD M16 butir 4).
 *
 * ⚠️ Berkas ini **dilarang** mengimpor apa pun dari `@/features/pos/**` atau
 * `@/lib/db/dexie`. Ditegakkan `no-restricted-imports` di `eslint.config.mjs`.
 */

import Dexie, { type Table } from 'dexie'

import type {
  OpnameLine,
  OpnameMaterial,
  OpnameMetaRow,
  OpnameResultLine,
  OpnameSession,
  OpnameStaff,
} from '@/lib/db/opname-models'

export class OpnameDatabase extends Dexie {
  sessions!: Table<OpnameSession, string>
  lines!: Table<OpnameLine, string>
  results!: Table<OpnameResultLine, string>
  materials!: Table<OpnameMaterial, string>
  staffs!: Table<OpnameStaff, string>
  meta!: Table<OpnameMetaRow, string>

  constructor() {
    super('posgodinov-opname')

    // v1 — baseline. Versi skema bersifat linear dan aditif, sama seperti
    // basis data kasir: jangan mengubah blok ini, tambahkan `version(2)` baru.
    this.version(1).stores({
      // `status` diindeks: layar daftar selalu memfilter sesi DRAFT.
      sessions: 'id, status, client_created_at, _synced',

      // Kunci majemuk `${session_id}:${raw_material_id}` dipakai sebagai primary
      // key, BUKAN UUID acak. Petugas menghitung ulang bahan yang sama berkali
      // -kali selama sesi berjalan; kunci majemuk membuat `put` menimpa baris
      // yang sama alih-alih menumpuk hitungan yang saling bertentangan.
      lines: 'key, session_id, raw_material_id',

      results: 'key, session_id, fraud_flag',
      materials: 'id, name',
      staffs: 'id, staff_identifier',
      meta: 'key',
    })
  }
}

export const opnameDb = new OpnameDatabase()

/** Kunci majemuk satu baris hitungan. */
export const lineKey = (sessionId: string, rawMaterialId: string): string =>
  `${sessionId}:${rawMaterialId}`

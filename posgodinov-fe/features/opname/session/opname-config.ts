'use client'

/**
 * Kebijakan operasional modul Opname — **butir 4** ([11 §M16.1], [11 §M18.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PEMBACA CONFIG TERSENDIRI, BUKAN `lib/pos/config.ts`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `readPosConfig()` membaca `meta` dari database **kasir** (`posgodinov`).
 * Memakainya di sini berarti modul gudang membuka IndexedDB kasir, dan seluruh
 * isolasi yang dibangun `opname-dexie.ts` runtuh pada baris impor pertama —
 * `no-restricted-imports` memang menolaknya.
 *
 * Bentuknya mirip; yang berbeda adalah satu-satunya hal yang penting: database
 * asalnya.
 */

import { opnameDb } from '@/lib/db/opname-dexie'

export type OpnameConfig = {
  /**
   * Bawaan `true`, dan bawaan itu KETAT dengan sengaja.
   *
   * Perangkat gudang yang belum pernah menarik `config` dari server berjalan
   * dengan Blind Opname penuh. Kebijakan longgar secara bawaan berarti outlet
   * yang syncnya tertinggal menghitung stok sambil melihat angka sistem tanpa
   * ada yang menyadarinya.
   */
  blindOpnameEnabled: boolean
}

export const DEFAULT_OPNAME_CONFIG: OpnameConfig = {
  blindOpnameEnabled: true,
}

type RawConfig = Partial<{ blind_opname_enabled: boolean }>

/**
 * Membaca blok `config` yang disimpan penarikan master data terakhir.
 *
 * Digabung per-field dengan bawaan, bukan per-objek: server yang mengirim
 * `config` separuh tidak boleh membuat field lain jatuh ke `undefined` dan
 * diam-diam mematikan pengendalian.
 */
export async function readOpnameConfig(): Promise<OpnameConfig> {
  try {
    const row = await opnameDb.meta.get('config')
    const raw = (row?.value ?? {}) as RawConfig

    return {
      blindOpnameEnabled:
        raw.blind_opname_enabled ?? DEFAULT_OPNAME_CONFIG.blindOpnameEnabled,
    }
  } catch {
    // Basis data yang tidak dapat dibaca TIDAK boleh melonggarkan kebijakan.
    // Gagal ke arah yang ketat adalah satu-satunya arah yang aman di sini.
    return DEFAULT_OPNAME_CONFIG
  }
}

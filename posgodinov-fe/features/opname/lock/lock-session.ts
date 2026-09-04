'use client'

/**
 * Penguncian sesi opname — **titik tak dapat dibatalkan** ([11 §M16.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KUNCI BERSIFAT SATU ARAH, DAN ITULAH YANG MEMBUATNYA BERARTI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Setelah terkunci, petugas tidak dapat kembali ke fase hitung. Bukan karena
 * tombolnya disembunyikan — server menolak `PUT /items` pada sesi non-DRAFT
 * dengan `409 OPNAME_ALREADY_LOCKED`, dan sesi lokal ikut berpindah status.
 *
 * Tanpa sifat satu arah itu, seluruh Blind Opname tidak bermakna: petugas cukup
 * mengunci, melihat selisihnya, membuka kembali, lalu "memperbaiki" hitungannya
 * sampai selisihnya nol. Hitung ulang menempuh **sesi baru** dengan
 * `recount_of`, bukan mengubah sesi yang sudah terkunci.
 */

import {
  createOpnameSession,
  lockOpnameSession,
  pushOpnameItems,
} from '@/lib/api/endpoints/opname'
import { lineKey } from '@/lib/db/opname-dexie'
import type { OpnameResultLine } from '@/lib/db/opname-models'
import {
  getSession,
  listLines,
  listMaterials,
  markSessionLocked,
  saveResults,
} from '@/features/opname/session/opname.repo'

export type LockOutcome =
  | { ok: true; lockedAt: string; itemsCounted: number }
  | { ok: false; error: string }

/**
 * Mendaftarkan sesi, mengirim seluruh hitungan, lalu menguncinya.
 *
 * TIGA panggilan, berurutan, dan urutannya mengikat:
 *
 *   1. `POST /sessions` — sesi lokal menyusul ke server
 *   2. `PUT /items`     — draf lokal menyusul ke server
 *   3. `POST /lock`     — snapshot stok diambil DI SERVER, satu transaksi
 *
 * Langkah 1 tidak dapat dilewati: sesi lahir OFFLINE di perangkat gudang, dan
 * server belum pernah mendengarnya. Ia idempoten — `Create` di server bersifat
 * `DO NOTHING` pada konflik id, sehingga percobaan ulang setelah jaringan putus
 * di tengah tidak melahirkan sesi kedua (aturan R2).
 *
 * Membalik langkah 2 dan 3 akan mengunci sesi yang isinya belum lengkap, dan
 * bahan yang hitungannya belum sampai akan tercatat sebagai selisih penuh —
 * tuduhan kehilangan barang terhadap orang yang justru sudah menghitungnya.
 *
 * ⚠️ Keduanya **memerlukan jaringan**. Itu disengaja dan tidak dapat dihindari:
 * snapshot `system_stock` hanya sah bila diambil server pada momen penguncian
 * ([11 §M16.2] — DoD butir 7). Perangkat gudang boleh menghitung sepenuhnya
 * offline; ia hanya perlu satu kali sinyal untuk mengunci.
 */
export async function lockSession(sessionId: string): Promise<LockOutcome> {
  try {
    const [lines, materials] = await Promise.all([listLines(sessionId), listMaterials()])

    if (lines.length === 0) {
      return { ok: false, error: 'Belum ada satu pun bahan yang dihitung.' }
    }

    const catalog = new Map(materials.map((m) => [m.id, m]))

    const session = await getSession(sessionId)
    if (!session) {
      return { ok: false, error: 'Sesi opname tidak ditemukan di perangkat ini.' }
    }

    // ── 1. Daftarkan sesi ────────────────────────────────────────────────
    //
    // UUID-nya milik KLIEN dan tidak pernah diregenerasi. Server mengenali id
    // yang sama sebagai sesi yang sama, sehingga panggilan ini aman diulang.
    await createOpnameSession({
      id: session.id,
      scope: session.scope,
      notes: session.notes,
      client_created_at: session.client_created_at,
    })

    // ── 2. Kirim hitungan ────────────────────────────────────────────────
    await pushOpnameItems(
      sessionId,
      lines.map((l) => ({
        raw_material_id: l.raw_material_id,
        actual_stock: l.counted,
        // Server yang mengonversi paket → satuan dasar; klien hanya melaporkan
        // angka yang benar-benar diketik petugas beserta satuannya. Mengonversi
        // di sini berarti faktor isi paket hidup di dua tempat, dan yang satu
        // pasti akan basi.
        actual_package_quantity: l.input_type === 'package_unit' ? l.counted : null,
        input_type: l.input_type,
        notes: l.notes,
      })),
    )

    // ── 3. Kunci — titik tak dapat dibatalkan ────────────────────────────
    const locked = await lockOpnameSession(sessionId)

    // Hasil disimpan lokal supaya layar hasil tetap terbaca bila sinyal hilang
    // segera setelah penguncian — yang lazim di gudang.
    const results: OpnameResultLine[] = (locked.items ?? []).map((it) => ({
      key: lineKey(sessionId, it.raw_material_id),
      session_id: sessionId,
      raw_material_id: it.raw_material_id,
      raw_material_name: it.raw_material_name || catalog.get(it.raw_material_id)?.name || '—',
      unit: it.unit || catalog.get(it.raw_material_id)?.unit || '',
      actual_stock: it.actual_stock,
      system_stock: it.system_stock,
      difference: it.difference,
      difference_value: it.difference_value,
      fraud_flag: it.fraud_flag,
    }))

    await saveResults(sessionId, results)
    await markSessionLocked(sessionId, locked.locked_at)

    return {
      ok: true,
      lockedAt: locked.locked_at,
      itemsCounted: locked.summary.items_counted,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengunci sesi. Periksa jaringan lalu coba lagi.',
    }
  }
}

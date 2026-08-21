/**
 * Shift kasir — docs/05 §1.5.1, docs/04 §A.3.
 *
 * UUID dibuat klien dan **tidak pernah** diregenerasi: `shifts.id` tidak punya
 * DEFAULT di database ([02 §2.11]), dan regenerasi berarti shift ganda.
 */

import { db } from '@/lib/db/dexie'
import type { LocalShift } from '@/lib/db/models'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'
import { notifyCommit } from '@/lib/sync/commit-notifier'

/**
 * Shift `OPEN` saat ini. Memakai indeks komposit `[status+_synced]`, tetapi
 * kedua nilai `_synced` harus diperiksa: shift yang sudah tersinkron pun tetap
 * `OPEN` sampai kasir menutupnya.
 */
export async function getOpenShift(): Promise<LocalShift | undefined> {
  return db.shifts.where('status').equals('OPEN').first()
}

/**
 * Membuka shift.
 *
 * [masterDataVersion] dan [deviceId] **wajib** sejak M15.1/M15.2 (butir 10 &
 * 12). Keduanya bukan metadata pelengkap:
 *
 *   · `master_data_version` adalah bukti bahwa katalog yang dipakai berjualan
 *     hari ini benar-benar yang terbaru. Server menolak shift `OPEN` tanpanya
 *     (`ck_shift_master_version` + gerbang di `syncShifts`).
 *   · `device_id` adalah yang dikunci `uq_shift_open_per_device`. Tanpa nilai
 *     yang stabil, satu perangkat dapat membuka shift berkali-kali.
 *
 * Pemanggil mendapatkannya dari `evaluateMasterGate()` dan `getDeviceId()`,
 * BUKAN dari nilai bawaan di sini — bawaan yang diam-diam benar akan membuat
 * gerbangnya dapat dilewati hanya dengan lupa meneruskan argumen.
 */
export async function openShift(params: {
  staffId: string
  /** Modal awal laci dalam **sen**. */
  openingBalanceMinor: number
  /** Versi master data yang benar-benar dipegang perangkat (butir 10). */
  masterDataVersion: number | null
  /** Identitas instalasi (butir 12). */
  deviceId: string
  /** `false` hanya bila pemilik mematikan Blind Closing ([11 §4.4]). */
  blindClose?: boolean
}): Promise<LocalShift> {
  const shift: LocalShift = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : newUuid(),
    staff_id: params.staffId,
    opening_balance: params.openingBalanceMinor,
    closing_balance: 0,
    // ⚠️ Keduanya DEPRECATED pada v2 dan tetap 0 seumur hidup baris ini.
    // Server menghitung ulang dan mengabaikan apa pun yang dikirim (R4);
    // mengisinya di klien hanya menghidupkan kembali angka yang tidak
    // berwenang.
    expected_balance: 0,
    discrepancy: 0,
    status: 'OPEN',
    client_opened_at: nowIso(),
    client_closed_at: null,

    // ── v2 ────────────────────────────────────────────────────────────────
    declared_cash: 0,
    declared_edc_total: 0,
    declared_qris_total: 0,
    blind_close: params.blindClose ?? true,
    master_data_version: params.masterDataVersion ?? undefined,
    device_id: params.deviceId,
    closed_by: null,

    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.shifts.add(shift)

  // Shift `OPEN` pun harus segera terkirim: transaksi memiliki foreign key ke
  // `shifts(id)`, sehingga induknya wajib sudah ada di server sebelum anaknya
  // tiba ([03 §2.3]).
  notifyCommit('shift')

  return shift
}

/**
 * Menutup shift — **Blind Closing**, butir 9 ([11 §M15.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA ANGKA MASUK. NOL ANGKA DIHITUNG.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Fungsi ini **tidak menerima dan tidak menghitung** `expected_balance` maupun
 * `discrepancy`. Keduanya milik `ShiftReconcileService` di server, dan itulah
 * seluruh maksud butir 9: orang yang paling berkepentingan agar selisihnya nol
 * tidak boleh menjadi orang yang menghitungnya.
 *
 * Parameter `expectedBalanceMinor` yang dulu ada di sini SENGAJA dihapus, bukan
 * dijadikan opsional. Parameter opsional akan tetap diisi oleh pemanggil lama
 * yang tidak dibaca ulang siapa pun, dan angkanya kembali merambat ke server.
 *
 * `closing_balance` v1 tetap diisi dari `declaredCashMinor` selama jendela
 * deprekasi M18: laporan lama membacanya, dan membiarkannya nol akan membuat
 * seluruh shift v2 tampak kosong di laporan yang belum dimigrasi.
 *
 * `_synced` dikembalikan ke `0`: penutupan adalah pengiriman KEDUA yang membawa
 * angka kas sesungguhnya, walau shift sudah tersinkron saat dibuka.
 */
export async function closeShift(params: {
  shiftId: string
  /** Uang fisik hasil hitung laci — sen. */
  declaredCashMinor: number
  /** Total settle yang dibacakan kasir dari mesin EDC — sen. */
  declaredEdcMinor: number
  /** Total settle QRIS — sen. */
  declaredQrisMinor: number
  /** `false` hanya bila pemilik mematikan Blind Closing. */
  blindClose?: boolean
  /** Diisi HANYA pada Force Close oleh supervisor ([11 §M15.2]). */
  closedBy?: string | null
}): Promise<void> {
  await db.shifts.update(params.shiftId, {
    status: 'CLOSED',
    declared_cash: params.declaredCashMinor,
    declared_edc_total: params.declaredEdcMinor,
    declared_qris_total: params.declaredQrisMinor,
    blind_close: params.blindClose ?? true,
    closed_by: params.closedBy ?? null,

    // Jendela deprekasi — lihat catatan di atas.
    closing_balance: params.declaredCashMinor,

    client_closed_at: nowIso(),
    _synced: 0,
  })

  // Momen paling penting untuk sampai ke server: laci sudah dihitung dan kasir
  // biasanya menutup aplikasi tepat setelah ini ([11 §M12.2]).
  notifyCommit('shift')
}

export const getShift = (id: string): Promise<LocalShift | undefined> => db.shifts.get(id)

export const countUnsyncedShifts = (): Promise<number> =>
  db.shifts.where('_synced').equals(0).count()

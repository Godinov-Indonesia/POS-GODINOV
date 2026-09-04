/**
 * Kebijakan operasional dari master data ([11 §4.4]).
 *
 * Nilai-nilainya hidup di server supaya pemilik dapat mengubah ambang batas
 * **tanpa merilis ulang tiga aplikasi**. Perangkat yang belum pernah menarik
 * master v2 memakai bawaan hard-coded di bawah — dan bawaannya sengaja KETAT:
 * kebijakan longgar secara bawaan berarti outlet yang belum pernah membuka
 * layar pengaturan berjalan tanpa pengendalian apa pun.
 */

import { VOID_THRESHOLD_QTY } from '@/lib/constants/cancellation'
import { getMeta } from '@/lib/db/repositories/meta.repo'

export type PosConfig = {
  voidThresholdQty: number
  requireSupervisorForVoid: boolean
  requireSupervisorForReturn: boolean
  blindCloseEnabled: boolean
  blindOpnameEnabled: boolean
  kioskExitPermission: string
  historyScope: 'ACTIVE_SHIFT' | 'ALL'
  masterDataMaxAgeMinutes: number
}

export const DEFAULT_POS_CONFIG: PosConfig = {
  voidThresholdQty: VOID_THRESHOLD_QTY,
  requireSupervisorForVoid: true,
  requireSupervisorForReturn: true,
  blindCloseEnabled: true,
  blindOpnameEnabled: true,
  kioskExitPermission: 'KIOSK_EXIT',
  historyScope: 'ACTIVE_SHIFT',
  masterDataMaxAgeMinutes: 720,
}

/** Bentuk mentah `config` pada respons master-data (snake_case). */
type RawConfig = Partial<{
  void_threshold_qty: number
  require_supervisor_for_void: boolean
  require_supervisor_for_return: boolean
  blind_close_enabled: boolean
  blind_opname_enabled: boolean
  kiosk_exit_permission: string
  history_scope: string
  master_data_max_age_minutes: number
}>

/**
 * Membaca konfigurasi yang tersimpan, dengan bawaan untuk setiap field yang
 * hilang.
 *
 * Digabung **per-field**, bukan per-objek: server yang mengirim `config`
 * separuh — mis. versi lama yang belum mengenal `history_scope` — tidak boleh
 * membuat field lainnya menjadi `undefined` dan diam-diam mematikan
 * pengendalian.
 */
export async function readPosConfig(): Promise<PosConfig> {
  const raw = (await getMeta<RawConfig>('config')) ?? {}

  return {
    voidThresholdQty: numberOr(raw.void_threshold_qty, DEFAULT_POS_CONFIG.voidThresholdQty),
    requireSupervisorForVoid:
      raw.require_supervisor_for_void ?? DEFAULT_POS_CONFIG.requireSupervisorForVoid,
    requireSupervisorForReturn:
      raw.require_supervisor_for_return ?? DEFAULT_POS_CONFIG.requireSupervisorForReturn,
    blindCloseEnabled: raw.blind_close_enabled ?? DEFAULT_POS_CONFIG.blindCloseEnabled,
    blindOpnameEnabled: raw.blind_opname_enabled ?? DEFAULT_POS_CONFIG.blindOpnameEnabled,
    kioskExitPermission: raw.kiosk_exit_permission ?? DEFAULT_POS_CONFIG.kioskExitPermission,
    historyScope: raw.history_scope === 'ALL' ? 'ALL' : DEFAULT_POS_CONFIG.historyScope,
    masterDataMaxAgeMinutes: numberOr(
      raw.master_data_max_age_minutes,
      DEFAULT_POS_CONFIG.masterDataMaxAgeMinutes,
    ),
  }
}

/**
 * Angka nol dan negatif ditolak, bukan diterima.
 *
 * `void_threshold_qty: 0` akan memaksa Void Sheet pada SETIAP penurunan satu
 * unit dan melumpuhkan kasir; nilai semacam itu hampir pasti kesalahan
 * konfigurasi, bukan kebijakan yang disengaja.
 */
const numberOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

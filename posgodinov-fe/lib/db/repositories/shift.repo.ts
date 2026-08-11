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

/**
 * Shift `OPEN` saat ini. Memakai indeks komposit `[status+_synced]`, tetapi
 * kedua nilai `_synced` harus diperiksa: shift yang sudah tersinkron pun tetap
 * `OPEN` sampai kasir menutupnya.
 */
export async function getOpenShift(): Promise<LocalShift | undefined> {
  return db.shifts.where('status').equals('OPEN').first()
}

export async function openShift(params: {
  staffId: string
  /** Modal awal laci dalam **sen**. */
  openingBalanceMinor: number
}): Promise<LocalShift> {
  const shift: LocalShift = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : newUuid(),
    staff_id: params.staffId,
    opening_balance: params.openingBalanceMinor,
    closing_balance: 0,
    expected_balance: 0,
    discrepancy: 0,
    status: 'OPEN',
    client_opened_at: nowIso(),
    client_closed_at: null,
    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }

  await db.shifts.add(shift)
  return shift
}

/**
 * Menutup shift. `expected_balance` dan `discrepancy` dihitung klien —
 * server tidak menghitung ulang, padahal `discrepancy` inilah yang muncul di
 * dashboard pemilik ([04 §A.3]).
 *
 * `_synced` dikembalikan ke `0`: penutupan adalah perubahan yang harus dikirim
 * ulang walau shift sudah pernah tersinkron saat dibuka. Backend memang
 * meng-upsert kolom penutupan ([02 §2.11]).
 */
export async function closeShift(params: {
  shiftId: string
  closingBalanceMinor: number
  expectedBalanceMinor: number
}): Promise<void> {
  await db.shifts.update(params.shiftId, {
    status: 'CLOSED',
    closing_balance: params.closingBalanceMinor,
    expected_balance: params.expectedBalanceMinor,
    discrepancy: params.closingBalanceMinor - params.expectedBalanceMinor,
    client_closed_at: nowIso(),
    _synced: 0,
  })
}

export const getShift = (id: string): Promise<LocalShift | undefined> => db.shifts.get(id)

export const countUnsyncedShifts = (): Promise<number> =>
  db.shifts.where('_synced').equals(0).count()

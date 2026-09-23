'use client'

/**
 * Pencatat peristiwa keamanan yang tahu KONTEKS-nya ([11 §1] aturan R9).
 *
 * `recordSecurityEvent` di lapisan `lib/` sengaja tidak mengetahui siapa kasir
 * yang sedang masuk maupun shift mana yang sedang berjalan — `lib/` tidak boleh
 * bergantung pada `features/` ([05 §1.1.1 butir 4]). Berkas ini menjembatani
 * keduanya, dan setiap pemanggil di layar POS memakainya alih-alih memungut
 * `staffId` sendiri-sendiri.
 *
 * Tanpa jembatan ini, peristiwa terkirim tanpa `staff_id` — dan peristiwa
 * keamanan tanpa pelaku adalah baris yang tidak dapat ditindaklanjuti siapa
 * pun.
 */

import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import type { SecurityEventType } from '@/lib/constants/security-events'
import type { SecuritySeverity } from '@/lib/db/models'
import { recordSecurityEvent } from '@/lib/db/repositories/security-event.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'

/**
 * Mencatat satu peristiwa beserta kasir dan shift yang sedang aktif.
 *
 * ⚠️ **Tidak pernah melempar.** Pemanggilnya selalu berada di jalur yang lebih
 * penting daripada pencatatan ini.
 */
export async function recordPosSecurityEvent(params: {
  eventType: SecurityEventType | string
  severity?: SecuritySeverity
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const staffId = usePosAuthStore.getState().staffId
    // Shift dibaca dari Dexie, bukan dari state React: pemanggil terbanyak
    // fungsi ini adalah penolakan aksi yang terjadi di luar pohon komponen —
    // percobaan logout lewat konsol, misalnya.
    const shift = await getOpenShift()

    await recordSecurityEvent({
      eventType: params.eventType,
      severity: params.severity,
      staffId,
      shiftId: shift?.id ?? null,
      details: params.details,
    })
  } catch {
    // sengaja diabaikan — lihat catatan pada `recordSecurityEvent`
  }
}

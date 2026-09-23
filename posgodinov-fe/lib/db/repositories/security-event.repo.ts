/**
 * `pos_security_events` — kanal audit yang **ikut antre sync** (aturan R9).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA BUKAN `audit_logs`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `audit_logs` di backend hanya menangkap permintaan HTTP. Kecurangan di POS
 * justru terjadi ketika perangkat offline — dan tidak ada satu pun permintaan
 * HTTP yang lahir dari peristiwa itu. Tanpa kanal ini, satu-satunya jejak
 * berada di perangkat yang orangnya sendiri pegang.
 */

import { db } from '@/lib/db/dexie'
import { SECURITY_EVENT, type SecurityEventType } from '@/lib/constants/security-events'
import type { LocalSecurityEvent, SecuritySeverity } from '@/lib/db/models'
import { newUuid } from '@/lib/uuid'

/**
 * Tingkat keparahan bawaan per jenis peristiwa.
 *
 * Diletakkan di satu tempat supaya sebuah peristiwa tidak pernah tercatat
 * `INFO` di satu pemanggil dan `CRITICAL` di pemanggil lain — laporan yang
 * memfilter berdasarkan severity akan kehilangan separuh barisnya.
 */
const DEFAULT_SEVERITY: Record<string, SecuritySeverity> = {
  [SECURITY_EVENT.VOID_RECEIPT_PRINT_FAILED]: 'CRITICAL',
  [SECURITY_EVENT.WASTE_RECEIPT_PRINT_FAILED]: 'CRITICAL',
  [SECURITY_EVENT.RETURN_RECEIPT_PRINT_FAILED]: 'CRITICAL',
  [SECURITY_EVENT.SALE_RECEIPT_PRINT_FAILED]: 'WARN',
  [SECURITY_EVENT.RECEIPT_REPRINTED]: 'WARN',
  [SECURITY_EVENT.VOID_AFTER_PRINT_ATTEMPTED]: 'WARN',
  [SECURITY_EVENT.QTY_DECREASE_ESCALATED_TO_VOID]: 'WARN',
  // CRITICAL, bukan WARN ([11 §M17.4]): percobaan membuka kunci perangkat
  // adalah peristiwa yang harus dilihat pemilik, bukan sekadar dicatat.
  [SECURITY_EVENT.KIOSK_EXIT_DENIED]: 'CRITICAL',
  [SECURITY_EVENT.KIOSK_EXIT_LOCKED_OUT]: 'CRITICAL',
  [SECURITY_EVENT.KIOSK_EXIT_GRANTED]: 'WARN',
  [SECURITY_EVENT.STAFF_SWITCH_BLOCKED]: 'WARN',
  [SECURITY_EVENT.PIN_FAILED_THRESHOLD]: 'CRITICAL',
  [SECURITY_EVENT.SHIFT_FORCE_CLOSED]: 'CRITICAL',
  [SECURITY_EVENT.OPEN_SHIFT_BLOCKED_STALE_MASTER]: 'WARN',
  [SECURITY_EVENT.LOGOUT_BLOCKED_ACTIVE_SHIFT]: 'WARN',
  [SECURITY_EVENT.CLOCK_SKEW_DETECTED]: 'WARN',
}

/**
 * Menulis satu peristiwa keamanan.
 *
 * ⚠️ **Tidak pernah melempar.** Pemanggilnya selalu berada di jalur yang lebih
 * penting daripada pencatatan ini — pembatalan yang sudah sah, penjualan yang
 * sudah dibayar — dan lemparan dari sini akan mendarat di blok `catch` yang
 * cepat atau lambat dipakai seseorang untuk menggulung transaksinya (R6).
 *
 * Mengembalikan `null` bila gagal, sehingga pemanggil yang peduli tetap dapat
 * mengetahuinya tanpa harus menangkap apa pun.
 */
export async function recordSecurityEvent(params: {
  eventType: SecurityEventType | string
  severity?: SecuritySeverity
  shiftId?: string | null
  staffId?: string | null
  details?: Record<string, unknown>
}): Promise<LocalSecurityEvent | null> {
  try {
    const event: LocalSecurityEvent = {
      id: newUuid(),
      shift_id: params.shiftId ?? null,
      staff_id: params.staffId ?? null,
      event_type: params.eventType,
      severity: params.severity ?? DEFAULT_SEVERITY[params.eventType] ?? 'INFO',
      details: params.details ?? {},
      client_created_at: new Date().toISOString(),
      _synced: 0,
      _syncAttempts: 0,
    }

    await db.securityEvents.add(event)
    return event
  } catch {
    return null
  }
}

/** Peristiwa yang menunggu giliran kirim, urut kronologis. */
export const listPendingSecurityEvents = (limit = 500): Promise<LocalSecurityEvent[]> =>
  db.securityEvents
    .where('_synced')
    .equals(0)
    .sortBy('client_created_at')
    .then((rows) => rows.slice(0, limit))

/** Jumlah temuan `CRITICAL` yang belum sampai ke pemilik. */
export const countPendingCriticalEvents = (): Promise<number> =>
  db.securityEvents
    .where('_synced')
    .equals(0)
    .filter((e) => e.severity === 'CRITICAL')
    .count()

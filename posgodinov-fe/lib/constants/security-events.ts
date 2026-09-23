/**
 * Kamus `event_type` untuk `pos_security_events` ([11 §3.3]).
 *
 * Sengaja berupa konstanta string dan bukan `enum` TypeScript: jenis peristiwa
 * baru akan bermunculan sepanjang umur produk, dan perangkat lama harus tetap
 * dapat mengirim jenis yang belum dikenalnya tanpa gagal mengurai.
 *
 * **Dijaga tetap identik** dengan `SecurityEventType` pada
 * `posgodinov-mobile/lib/core/config/constants.dart`. Nama yang berbeda antar
 * platform membuat laporan pemilik memecah satu peristiwa menjadi dua baris
 * yang tampak tidak berhubungan.
 */
export const SECURITY_EVENT = {
  KIOSK_EXIT_GRANTED: 'KIOSK_EXIT_GRANTED',
  KIOSK_EXIT_DENIED: 'KIOSK_EXIT_DENIED',
  /**
   * Tiga kegagalan berturut menjatuhkan jeda 60 detik ([11 §M17.4]).
   *
   * Dipisah dari `KIOSK_EXIT_DENIED` karena maknanya berbeda bagi pemilik:
   * satu penolakan adalah salah ketik, tiga berturut adalah pola.
   */
  KIOSK_EXIT_LOCKED_OUT: 'KIOSK_EXIT_LOCKED_OUT',
  LOGOUT_BLOCKED_ACTIVE_SHIFT: 'LOGOUT_BLOCKED_ACTIVE_SHIFT',
  STAFF_SWITCH_BLOCKED: 'STAFF_SWITCH_BLOCKED',
  OPEN_SHIFT_BLOCKED_STALE_MASTER: 'OPEN_SHIFT_BLOCKED_STALE_MASTER',
  QTY_DECREASE_ESCALATED_TO_VOID: 'QTY_DECREASE_ESCALATED_TO_VOID',
  VOID_RECEIPT_PRINT_FAILED: 'VOID_RECEIPT_PRINT_FAILED',
  WASTE_RECEIPT_PRINT_FAILED: 'WASTE_RECEIPT_PRINT_FAILED',
  RETURN_RECEIPT_PRINT_FAILED: 'RETURN_RECEIPT_PRINT_FAILED',
  SALE_RECEIPT_PRINT_FAILED: 'SALE_RECEIPT_PRINT_FAILED',
  RECEIPT_REPRINTED: 'RECEIPT_REPRINTED',
  VOID_AFTER_PRINT_ATTEMPTED: 'VOID_AFTER_PRINT_ATTEMPTED',
  /** Supervisor menutup paksa shift orang lain ([11 §M15.2]) — selalu CRITICAL. */
  SHIFT_FORCE_CLOSED: 'SHIFT_FORCE_CLOSED',
  PIN_FAILED_THRESHOLD: 'PIN_FAILED_THRESHOLD',
  CLOCK_SKEW_DETECTED: 'CLOCK_SKEW_DETECTED',
} as const

export type SecurityEventType = (typeof SECURITY_EVENT)[keyof typeof SECURITY_EVENT]

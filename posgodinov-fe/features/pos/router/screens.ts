/**
 * Layar POS — docs/04 §A.1.
 *
 * Seluruh 13 layar adalah client component di bawah satu route `/pos`
 * (ADR-02). P-01 (binding) sengaja berada di route terpisah karena hanya
 * dipakai sekali saat pemasangan dan memerlukan jaringan.
 */
export const POS_SCREENS = [
  'sync-master', // P-02
  'login', // P-03
  'open-shift', // P-04
  'register', // P-05
  'payment', // P-06
  'receipt', // P-07
  'held-carts', // P-08
  'history', // P-09
  'void', // P-10
  'product-waste', // P-11
  'close-shift', // P-12
  'sync-status', // P-13
  'settings', // P-14
] as const

export type PosScreen = (typeof POS_SCREENS)[number]

export const isPosScreen = (value: string): value is PosScreen =>
  (POS_SCREENS as readonly string[]).includes(value)

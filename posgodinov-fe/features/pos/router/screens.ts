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

  /* ── P-06 Pembayaran — DIPECAH pada M17.2 (butir 11) ──────────────────────
   *
   * Sub-langkah pembayaran dulu berupa cabang `if` di dalam SATU layar:
   * pemilihan metode, input tunai, dan konfirmasi hidup di komponen yang sama.
   * Konsekuensinya, tombol back perangkat menutup SELURUH pembayaran — kasir
   * yang salah pilih metode kehilangan seluruh langkahnya dan harus mengulang
   * dari keranjang.
   *
   * Sebagai rute tersendiri, masing-masing punya entri `history.pushState`
   * sendiri: back mundur SATU langkah, dan keranjang tidak tersentuh.
   */
  'payment', // P-06 — pemilih metode
  'payment-cash', // P-06a
  'payment-card', // P-06b — form butir 8 (trace number + 4 digit akhir)
  'payment-split', // P-06c — multi-tender

  'receipt', // P-07
  'held-carts', // P-08
  'history', // P-09
  'void', // P-10
  'return', // P-15 — retur, lahir pada Fase M13.3
  'product-waste', // P-11
  'close-shift', // P-12
  'sync-status', // P-13
  'settings', // P-14
] as const

export type PosScreen = (typeof POS_SCREENS)[number]

export const isPosScreen = (value: string): value is PosScreen =>
  (POS_SCREENS as readonly string[]).includes(value)

/**
 * Batas keras yang ditegakkan frontend — docs/05 §1.8.3 & §1.6.2.
 *
 * Seluruh angka di sini menutup ketiadaan paginasi di backend. Melonggarkannya
 * berarti menarik seluruh riwayat sejak awal dalam satu response.
 */

/**
 * Tidak ada paginasi di endpoint laporan mana pun ([03 §11.2]). UI menegakkan
 * batas keras 7 hari ([04 §0 #7]).
 */
export const REPORT_MAX_RANGE_DAYS = 7

/**
 * Preset **"Semua waktu" sengaja tidak disediakan.** Menghilangkan filter
 * tanggal berarti menarik seluruh riwayat dalam satu response.
 */
export const REPORT_PRESETS = [
  { label: 'Hari Ini', days: 1 },
  { label: '7 Hari', days: 7 },
  /** Dihitung dari tanggal 1; diperingatkan bila melebihi 7 hari. */
  { label: 'Bulan Ini', days: null },
] as const

export type ReportPreset = (typeof REPORT_PRESETS)[number]

/** Membatasi ukuran payload sync-up; tanpa paginasi di sisi server ([05 §1.6.2]). */
export const MAX_TRANSACTIONS_PER_BATCH = 200

/** `GET /v1/pos/transactions` di-hard-code 50 di backend ([03 §2.4]). */
export const POS_SERVER_HISTORY_LIMIT = 50

/** Panjang PIN kasir divalidasi backend: 4-6 karakter ([03 §4.1]). */
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6

/** Master data ditarik ulang bila `master.lastSyncAt` lebih tua dari ini ([05 §1.5.1]). */
export const MASTER_SYNC_STALE_MS = 12 * 60 * 60 * 1000

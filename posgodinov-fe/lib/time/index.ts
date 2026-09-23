/**
 * Waktu & deteksi jam melenceng — docs/05 §1.8.2 & §1.8.3.
 *
 * Berkas ini sengaja **tidak** mengimpor `lib/db`: Admin memakainya untuk
 * rentang laporan, dan menarik Dexie ke bundle Admin melanggar batas modul
 * ([05 §1.1.4]). Efek samping penyimpanan skew didaftarkan POS lewat
 * `subscribeClockSkew()`.
 */

import { REPORT_MAX_RANGE_DAYS } from '@/lib/constants/limits'

/** Seluruh field `client_*` dikirim ISO-8601 dengan zona waktu ([04 §C.5]). */
export const nowIso = (): string => new Date().toISOString()

/** Ambang peringatan: 5 menit. Di bawah ini, laporan masih dapat dipercaya. */
export const SKEW_WARN_MS = 5 * 60_000

export type ClockSkewListener = (skewMs: number, significant: boolean) => void

const skewListeners = new Set<ClockSkewListener>()

export function subscribeClockSkew(listener: ClockSkewListener): () => void {
  skewListeners.add(listener)
  return () => skewListeners.delete(listener)
}

/**
 * Dipanggil dari header `Date` setiap response ([05 §1.8.2]).
 *
 * ⚠️ **Jangan mengoreksi otomatis.** Menggeser `client_created_at` berdasarkan
 * skew membuat data lokal tidak konsisten dengan struk yang sudah tercetak.
 * Peringatkan operator dan minta jam perangkat diperbaiki.
 */
export function detectClockSkew(serverDateHeader: string | null): void {
  if (!serverDateHeader) return

  const serverMs = new Date(serverDateHeader).getTime()
  if (Number.isNaN(serverMs)) return

  const skew = Date.now() - serverMs
  const significant = Math.abs(skew) > SKEW_WARN_MS

  for (const listener of skewListeners) listener(skew, significant)
}

export const formatSkewMinutes = (skewMs: number): number => Math.round(Math.abs(skewMs) / 60_000)

/* ───────────────────────── Rentang tanggal laporan ───────────────────────── */

export type DateRange = {
  /** `YYYY-MM-DD` */
  start: string
  /** `YYYY-MM-DD` */
  end: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` menurut zona waktu lokal perangkat, bukan UTC. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Rentang `days` hari yang berakhir hari ini (inklusif). `days = 1` → hanya hari ini. */
export function lastNDays(days: number): DateRange {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * MS_PER_DAY)
  return { start: toDateKey(start), end: toDateKey(end) }
}

/** Dari tanggal 1 bulan berjalan sampai hari ini — bisa melebihi batas 7 hari. */
export function monthToDate(): DateRange {
  const now = new Date()
  return { start: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: toDateKey(now) }
}

/** Selisih hari inklusif: `2026-08-10` → `2026-08-10` bernilai 1. */
export function rangeLengthDays(range: DateRange): number {
  const start = new Date(`${range.start}T00:00:00`).getTime()
  const end = new Date(`${range.end}T00:00:00`).getTime()
  return Math.floor((end - start) / MS_PER_DAY) + 1
}

export function isRangeWithinLimit(range: DateRange): boolean {
  const length = rangeLengthDays(range)
  return length >= 1 && length <= REPORT_MAX_RANGE_DAYS
}

/** Waktu tampil ringkas untuk struk & riwayat, mis. `10 Agu 2026 14.05`. */
export function formatDateTimeId(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTimeId(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

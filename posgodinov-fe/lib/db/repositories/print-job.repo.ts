/**
 * Antrean cetak — **murni lokal, tidak pernah di-sync** ([11 §3.8]).
 *
 * Tabelnya sengaja tidak memiliki `_synced`: antrean cetak adalah urusan
 * perangkat dan printernya, bukan urusan server. Kehadiran kolom itu akan
 * menggoda seseorang memasukkannya ke payload sinkronisasi.
 */

import { db } from '@/lib/db/dexie'
import type { PrintJob, PrintJobKind, PrintJobStatus } from '@/lib/db/models'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

/**
 * Batas percobaan sebelum job dinyatakan `ABANDONED`.
 *
 * Setelahnya dibutuhkan tindakan manual kasir. Mencoba tanpa henti hanya
 * menghabiskan baterai dan — lebih buruk — menyembunyikan bahwa printernya
 * memang mati, sehingga kasir baru menyadarinya saat tutup shift.
 */
export const MAX_PRINT_ATTEMPTS = 3

/**
 * Jeda sebelum percobaan ke-N+1, dalam milidetik ([11 §M14.1]).
 *
 * Mencoba lagi seketika hampir selalu gagal dengan cara yang sama: printer
 * Bluetooth yang baru putus butuh beberapa detik sebelum adapter mau menerima
 * koneksi baru, dan tiga kegagalan dalam 200 ms hanya menghabiskan jatah
 * percobaan tanpa pernah benar-benar mencoba.
 *
 * Entri ketiga tidak terjangkau selama [MAX_PRINT_ATTEMPTS] bernilai 3 — ia ada
 * agar menaikkan ambangnya tidak menuntut tabel ini ikut diubah.
 */
export const PRINT_BACKOFF_MS: readonly number[] = [3_000, 10_000, 30_000]

/** Jeda yang berlaku untuk job dengan [attempts] kegagalan. */
export function printBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0
  return PRINT_BACKOFF_MS[Math.min(attempts, PRINT_BACKOFF_MS.length) - 1] ?? 0
}

/** Kapan sebuah job boleh dicoba lagi. `0` berarti sekarang juga. */
export function dueAt(job: PrintJob): number {
  if (job.status === 'PENDING') return 0
  if (job.status !== 'FAILED') return Number.POSITIVE_INFINITY
  const last = job.last_attempt_at ? Date.parse(job.last_attempt_at) : 0
  return last + printBackoffMs(job.attempts)
}

export async function createPrintJob(params: {
  kind: PrintJobKind
  refType: string
  refId: string
  /** Byte ESC/POS yang **sudah dirender**. */
  payload: Uint8Array
}): Promise<PrintJob> {
  const job: PrintJob = {
    id: newUuid(),
    kind: params.kind,
    status: 'PENDING',
    ref_type: params.refType,
    ref_id: params.refId,
    payload: bytesToBase64(params.payload),
    attempts: 0,
    last_error: null,
    created_at: nowIso(),
    printed_at: null,
  }

  await db.printJobs.add(job)
  return job
}

/** Job yang menunggu giliran cetak, urut kronologis. */
export const listPendingPrintJobs = (limit = 20): Promise<PrintJob[]> =>
  db.printJobs.where('status').equals('PENDING').sortBy('created_at').then((rows) => rows.slice(0, limit))

/**
 * Job yang **boleh dikirim sekarang**: `PENDING`, ditambah `FAILED` yang jeda
 * mundurnya sudah lewat.
 *
 * ⚠️ Mengabaikan `FAILED` — seperti yang dilakukan [listPendingPrintJobs]
 * sendirian — membuat "retry otomatis ≤ 3×" tidak pernah terjadi: percobaan
 * kedua hanya akan datang bila kasir menekan tombol, dan itu percobaan manual.
 */
export async function listDuePrintJobs(limit = 20): Promise<PrintJob[]> {
  const now = Date.now()
  const rows = await db.printJobs
    .where('status')
    .anyOf('PENDING', 'FAILED')
    .filter((job) => dueAt(job) <= now)
    .sortBy('created_at')
  return rows.slice(0, limit)
}

/**
 * Milidetik menuju job berikutnya yang akan jatuh tempo, atau `null` bila tidak
 * ada yang menunggu.
 *
 * Dipakai penjadwal flush: tanpa ini job `FAILED` hanya dicoba lagi bila ada
 * peristiwa lain yang kebetulan memicu flush.
 */
export async function msUntilNextDue(): Promise<number | null> {
  const rows = await db.printJobs.where('status').equals('FAILED').toArray()
  if (rows.length === 0) return null

  const soonest = Math.min(...rows.map(dueAt))
  if (!Number.isFinite(soonest)) return null
  return Math.max(0, soonest - Date.now())
}

/**
 * Jumlah struk yang **belum** berhasil tercetak.
 *
 * Sumber banner persisten. Mencakup `PENDING`, `FAILED`, dan `ABANDONED` karena
 * ketiganya sama-sama berarti tidak ada kertas di tangan siapa pun.
 */
export async function countUnprintedJobs(): Promise<number> {
  const [pending, failed, abandoned] = await Promise.all([
    db.printJobs.where('status').equals('PENDING').count(),
    db.printJobs.where('status').equals('FAILED').count(),
    db.printJobs.where('status').equals('ABANDONED').count(),
  ])
  return pending + failed + abandoned
}

/** Job yang menuntut tindakan manusia — sudah habis jatah percobaannya. */
export const listAbandonedJobs = (): Promise<PrintJob[]> =>
  db.printJobs.where('status').equals('ABANDONED').reverse().sortBy('created_at')

export const getPrintJob = (id: string): Promise<PrintJob | undefined> => db.printJobs.get(id)

/** Seluruh job untuk satu entitas — dasar fitur cetak ulang. */
export const listPrintJobsByRef = (refType: string, refId: string): Promise<PrintJob[]> =>
  db.printJobs.where('ref_id').equals(refId).filter((j) => j.ref_type === refType).sortBy('created_at')

export const markPrinting = (id: string): Promise<number> =>
  db.printJobs.update(id, { status: 'PRINTING' as PrintJobStatus })

export const markPrinted = (id: string): Promise<number> =>
  db.printJobs.update(id, {
    status: 'PRINTED' as PrintJobStatus,
    printed_at: nowIso(),
    last_error: null,
  })

/**
 * Mencatat kegagalan dan memutuskan apakah job masih layak dicoba lagi.
 *
 * Mengembalikan status baru agar pemanggil tahu kapan harus memunculkan
 * peringatan yang menuntut tindakan manual.
 */
export async function markPrintFailed(id: string, reason: string): Promise<PrintJobStatus> {
  const job = await db.printJobs.get(id)
  if (!job) return 'ABANDONED'

  const attempts = job.attempts + 1
  const status: PrintJobStatus = attempts >= MAX_PRINT_ATTEMPTS ? 'ABANDONED' : 'FAILED'

  await db.printJobs.update(id, {
    status,
    attempts,
    last_error: reason,
    last_attempt_at: nowIso(),
  })
  return status
}

/**
 * Mengembalikan job gagal ke antrean.
 *
 * ⚠️ `payload` **tidak** dirender ulang. Kertas hasil cetak ulang harus identik
 * byte demi byte dengan yang pertama: data sumbernya mungkin sudah berubah —
 * nama produk diperbarui pemilik, harga naik — dan struk pembatalan yang isinya
 * berbeda dari yang pertama tidak dapat dipakai sebagai bukti audit.
 */
export const requeuePrintJob = (id: string): Promise<number> =>
  db.printJobs.update(id, {
    status: 'PENDING' as PrintJobStatus,
    last_error: null,
    // Dinolkan supaya ketukan kasir dikirim SEKARANG. Jeda mundur ada untuk
    // percobaan otomatis; orang yang berdiri di depan printer sudah tahu
    // printernya baru saja diperbaiki.
    last_attempt_at: null,
  })

/* ── base64 ───────────────────────────────────────────────────────────────── */

/**
 * Byte → base64.
 *
 * `String.fromCharCode(...bytes)` dengan spread akan melempar
 * `RangeError: Maximum call stack size exceeded` pada struk panjang; potongan
 * 8 KiB menghindarinya tanpa menambah dependensi.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x2000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Memangkas job lama yang sudah tercetak.
 *
 * `payload` berisi byte penuh setiap struk; tanpa pemangkasan, tabel ini tumbuh
 * sebesar seluruh riwayat cetak perangkat. Job yang BELUM tercetak tidak pernah
 * dipangkas berapa pun umurnya — ia masih menunggu tindakan.
 */
export async function prunePrintedJobs(keep = 100): Promise<void> {
  const printed = await db.printJobs.where('status').equals('PRINTED').sortBy('created_at')
  const excess = printed.length - keep
  if (excess <= 0) return

  await db.printJobs.bulkDelete(printed.slice(0, excess).map((job) => job.id))
}

/**
 * Antrean cetak yang tahan gagal — **butir 6 & 7** ([11 §M14.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ATURAN R6 — KEGAGALAN CETAK TIDAK PERNAH MEMBATALKAN PENULISAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Uang sudah berpindah. Printer mati adalah masalah operasional, bukan alasan
 * menghilangkan penjualan, pembatalan, atau retur yang sudah terjadi.
 *
 * Konsekuensinya mengikat seluruh berkas ini: **tidak satu pun fungsi `enqueue*`
 * boleh melempar.** Pemanggilnya berada tepat setelah penulisan Dexie, dan
 * lemparan dari sini akan mendarat di blok `catch` yang — cepat atau lambat —
 * akan dipakai seseorang untuk menggulung transaksinya.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DIRENDER SEKALI, DIKIRIM BERKALI-KALI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   enqueue → render ESC/POS SEKALI → simpan payload → kirim → tandai
 *
 * Payload disimpan sebagai byte jadi, bukan sebagai data sumbernya. Cetak ulang
 * mengirim byte yang sama persis, sehingga kertas kedua identik dengan yang
 * pertama walau nama produk sudah diperbarui pemilik atau harganya sudah naik.
 * Struk pembatalan yang isinya berbeda dari cetakan pertama tidak dapat dipakai
 * sebagai bukti audit — dan bukti audit adalah satu-satunya alasan ia dicetak.
 */

import { db } from '@/lib/db/dexie'
import type { PrintJob, PrintJobKind } from '@/lib/db/models'
import {
  base64ToBytes,
  countUnprintedJobs,
  createPrintJob,
  getPrintJob,
  listDuePrintJobs,
  markPrinted,
  markPrintFailed,
  markPrinting,
  MAX_PRINT_ATTEMPTS,
  msUntilNextDue,
  prunePrintedJobs,
  requeuePrintJob,
} from '@/lib/db/repositories/print-job.repo'
import { recordSecurityEvent } from '@/lib/db/repositories/security-event.repo'
import { SECURITY_EVENT } from '@/lib/constants/security-events'
import {
  renderCancelReceipt,
  renderReturnReceipt,
  renderWasteReceipt,
  type CancelReceipt,
  type ReturnReceipt,
  type WasteReceipt,
} from '@/lib/printer/audit-receipts'
import { renderReceipt } from '@/lib/printer/receipt-renderer'
import { renderShiftReport, type ShiftReport } from '@/lib/printer/shift-report'
import { getPrinterColumns, resolvePrinter } from '@/lib/printer/registry'
import type { Receipt } from '@/lib/printer/types'

/** Dilaporkan ke UI setiap kali antrean berubah. */
export type PrintQueueSnapshot = {
  /** `PENDING` + `FAILED` + `ABANDONED`. */
  unprinted: number
  flushing: boolean
}

type Listener = (snapshot: PrintQueueSnapshot) => void

let snapshot: PrintQueueSnapshot = { unprinted: 0, flushing: false }
const listeners = new Set<Listener>()

function emit(next: PrintQueueSnapshot): void {
  // Perbandingan per-field: `useSyncExternalStore` membandingkan snapshot
  // dengan kesamaan REFERENSI, sehingga objek baru pada setiap pembacaan
  // menghasilkan render tak berujung.
  if (next.unprinted === snapshot.unprinted && next.flushing === snapshot.flushing) return
  snapshot = next
  for (const listener of listeners) listener(snapshot)
}

export function subscribePrintQueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getPrintQueueSnapshot = (): PrintQueueSnapshot => snapshot

/** Snapshot sisi server — POS tidak pernah dirender di server. */
export const getPrintQueueServerSnapshot = (): PrintQueueSnapshot => SERVER_SNAPSHOT
const SERVER_SNAPSHOT: PrintQueueSnapshot = { unprinted: 0, flushing: false }

/** Menyegarkan hitungan dari Dexie. Aman dipanggil kapan saja. */
export async function refreshPrintQueue(): Promise<void> {
  try {
    emit({ ...snapshot, unprinted: await countUnprintedJobs() })
  } catch {
    // Hitungan banner bukan data keuangan; kegagalan membacanya tidak boleh
    // merambat ke pemanggil.
  }
}

/* ── Enqueue ──────────────────────────────────────────────────────────────── */

/**
 * Inti antrean: render sekali, simpan, lalu coba kirim.
 *
 * **Tidak pernah melempar** (aturan R6). Kegagalan apa pun — render, tulis
 * Dexie, kirim — berakhir sebagai `null` beserta banner yang menyala.
 */
async function enqueue(
  kind: PrintJobKind,
  refType: string,
  refId: string,
  render: (columns: 32 | 42) => Uint8Array,
): Promise<PrintJob | null> {
  try {
    const columns = await getPrinterColumns()
    const payload = render(columns)
    const job = await createPrintJob({ kind, refType, refId, payload })

    await refreshPrintQueue()
    // Pengiriman TIDAK ditunggu: kasir tidak boleh menatap layar beku selama
    // adapter Bluetooth menegosiasikan koneksi. Barisnya sudah aman di Dexie.
    void flushPrintQueue()

    return job
  } catch {
    // Termasuk kegagalan menulis job itu sendiri. Yang hilang hanyalah kertas;
    // transaksinya tetap tersimpan, dan itulah urutan prioritas yang benar.
    void refreshPrintQueue()
    return null
  }
}

export const enqueueSaleReceipt = (
  transactionId: string,
  receipt: Receipt,
): Promise<PrintJob | null> =>
  enqueue('SALE_RECEIPT', 'transaction', transactionId, (columns) =>
    renderReceipt(receipt, { columns }),
  )

/** Butir 6 — dipakai KETIGA cakupan void. */
export const enqueueCancelReceipt = (
  voidLogId: string,
  receipt: CancelReceipt,
): Promise<PrintJob | null> =>
  enqueue('CANCEL_RECEIPT', 'void_log', voidLogId, (columns) =>
    renderCancelReceipt(receipt, { columns }),
  )

/** Butir 7. */
export const enqueueWasteReceipt = (
  wasteId: string,
  receipt: WasteReceipt,
): Promise<PrintJob | null> =>
  enqueue('WASTE_RECEIPT', 'waste', wasteId, (columns) =>
    renderWasteReceipt(receipt, { columns }),
  )

/**
 * Butir 9 — laporan tutup shift.
 *
 * ⚠️ [report] hanya memuat angka DEKLARASI. Lihat catatan pada
 * `renderShiftReport`: mencetak ekspektasi di kertas membatalkan Blind Closing
 * dengan cara yang lebih sulit ditarik kembali daripada menampilkannya di layar.
 */
export const enqueueShiftReport = (
  shiftId: string,
  report: ShiftReport,
): Promise<PrintJob | null> =>
  enqueue('SHIFT_REPORT', 'shift', shiftId, (columns) =>
    renderShiftReport(report, { columns }),
  )

export const enqueueReturnReceipt = (
  returnId: string,
  receipt: ReturnReceipt,
): Promise<PrintJob | null> =>
  enqueue('RETURN_RECEIPT', 'return', returnId, (columns) =>
    renderReturnReceipt(receipt, { columns }),
  )

/* ── Flush ────────────────────────────────────────────────────────────────── */

/**
 * Mutex modul.
 *
 * Dua flush bersamaan akan mengirim job yang sama dua kali — dan tidak seperti
 * sinkronisasi, printer tidak idempoten: hasilnya dua lembar kertas untuk satu
 * peristiwa. Mutex per-modul cukup di sini karena adapter printer memang
 * terikat pada satu tab.
 */
let flushing = false

/**
 * Mengirim seluruh job `PENDING` secara berurutan.
 *
 * **Tidak pernah melempar.** Kegagalan satu job dicatat pada barisnya sendiri
 * dan tidak menghentikan job berikutnya: printer yang menolak satu struk
 * bermasalah tetap dapat mencetak sisanya.
 */
export async function flushPrintQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  emit({ ...snapshot, flushing: true })

  try {
    const jobs = await listDuePrintJobs()
    if (jobs.length === 0) return

    const printer = await resolvePrinter()
    await printer.connect()

    for (const job of jobs) {
      await sendOne(printer, job)
    }

    await prunePrintedJobs()
  } catch {
    // Kegagalan di luar per-job — mis. adapter menolak `connect()`. Job-nya
    // tetap `PENDING` dan akan dicoba lagi pada pemicu berikutnya.
  } finally {
    flushing = false
    emit({ ...snapshot, flushing: false })
    await refreshPrintQueue()
    await scheduleNextFlush()
  }
}

/**
 * Menjadwalkan flush berikutnya pada saat job `FAILED` paling awal jatuh tempo.
 *
 * Tanpa penjadwal, "retry otomatis ≤ 3×" hanya terjadi bila kebetulan ada
 * peristiwa lain yang memicu flush — dan pada perangkat yang menganggur setelah
 * transaksi terakhir, peristiwa itu tidak pernah datang. Percobaan kedua akan
 * menunggu sampai kasir menekan tombol, yang membuatnya percobaan manual.
 */
let retryTimer: ReturnType<typeof setTimeout> | null = null

async function scheduleNextFlush(): Promise<void> {
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  const delay = await msUntilNextDue()
  if (delay === null) return

  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushPrintQueue()
  }, delay)
}

async function sendOne(
  printer: { print: (payload: Uint8Array) => Promise<void> },
  job: PrintJob,
): Promise<void> {
  try {
    await markPrinting(job.id)
    await printer.print(base64ToBytes(job.payload))
    await markPrinted(job.id)
    await stampSource(job)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Gagal mencetak'
    const status = await markPrintFailed(job.id, reason)

    if (status === 'ABANDONED') {
      // ── R9 — jejaknya ikut antrean sync ────────────────────────────────
      //
      // Ditulis di sini, bukan di dalam kait `onAbandoned`: kait itu opsional
      // dan hanya terpasang selama ada UI yang memasangnya. Struk pembatalan
      // yang menyerah pada perangkat yang layarnya sedang menampilkan hal lain
      // tetap harus sampai ke pemilik.
      await recordSecurityEvent({
        eventType: PRINT_FAILURE_EVENT[job.kind],
        details: {
          print_job_id: job.id,
          kind: job.kind,
          ref_type: job.ref_type,
          ref_id: job.ref_id,
          attempts: MAX_PRINT_ATTEMPTS,
          last_error: reason,
        },
      })

      // Sengaja TIDAK melempar. Job yang menyerah adalah kondisi yang harus
      // dilihat kasir lewat banner, bukan kondisi yang menghentikan antrean —
      // struk berikutnya mungkin justru berhasil.
      onAbandoned?.(job, reason)
    }
  }
}

/**
 * Jenis job → jenis peristiwa keamanan saat ia menyerah ([11 §3.3]).
 *
 * Struk penjualan `WARN`, sisanya `CRITICAL`: penjualan yang struknya gagal
 * masih meninggalkan barisnya sendiri di server, sedangkan pembatalan, retur,
 * dan pembuangan justru KERTASNYA yang menjadi bukti — tanda tangan pemberi
 * otoritas tidak ada di tempat lain mana pun.
 */
const PRINT_FAILURE_EVENT: Record<PrintJobKind, string> = {
  SALE_RECEIPT: SECURITY_EVENT.SALE_RECEIPT_PRINT_FAILED,
  CANCEL_RECEIPT: SECURITY_EVENT.VOID_RECEIPT_PRINT_FAILED,
  WASTE_RECEIPT: SECURITY_EVENT.WASTE_RECEIPT_PRINT_FAILED,
  RETURN_RECEIPT: SECURITY_EVENT.RETURN_RECEIPT_PRINT_FAILED,
  SHIFT_REPORT: SECURITY_EVENT.SALE_RECEIPT_PRINT_FAILED,
}

/**
 * Menandai baris SUMBER bahwa kertasnya benar-benar terbit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INILAH TITIK YANG MENENTUKAN VOID vs RETUR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `transactions.receipt_printed_at` adalah diskriminator butir 15 ([11 §2.1]),
 * dan ia diisi **di sini** — bukan saat perintah cetak dikirim. Perintah yang
 * gagal di tengah tidak menghasilkan kertas di tangan siapa pun, dan menandai
 * transaksi sebagai "sudah tercetak" karena perintahnya terkirim akan menutup
 * jalur Void untuk transaksi yang struknya tidak pernah keluar.
 *
 * Cetakan pertama mengisi `receipt_printed_at`; cetakan berikutnya hanya
 * menaikkan `reprint_count` dan **tidak** menggeser waktunya — waktu itu
 * menandai kapan dokumen pertama berpindah tangan, bukan kapan salinannya
 * dibuat.
 *
 * Kegagalan menandai ditelan: kertasnya sudah terlanjur keluar, dan melempar di
 * sini tidak akan menariknya kembali.
 */
async function stampSource(job: PrintJob): Promise<void> {
  const at = new Date().toISOString()

  try {
    switch (job.kind) {
      case 'SALE_RECEIPT': {
        const transaction = await db.transactions.get(job.ref_id)
        if (!transaction) return
        await db.transactions.update(job.ref_id, {
          receipt_printed_at: transaction.receipt_printed_at ?? at,
          reprint_count: transaction.receipt_printed_at
            ? (transaction.reprint_count ?? 0) + 1
            : (transaction.reprint_count ?? 0),
        })
        return
      }
      case 'CANCEL_RECEIPT':
        await db.voidLogs.update(job.ref_id, {
          receipt_printed: true,
          receipt_printed_at: at,
        })
        return
      case 'WASTE_RECEIPT':
        await db.wastes.update(job.ref_id, { receipt_printed: true, printed_at: at })
        return
      case 'RETURN_RECEIPT':
        await db.returns.update(job.ref_id, {
          receipt_printed: true,
          receipt_printed_at: at,
        })
        return
      case 'SHIFT_REPORT':
        // Laporan shift tidak memiliki kolom bukti cetak; barisnya sendiri
        // yang menjadi buktinya.
        return
    }
  } catch {
    // sengaja diabaikan — lihat catatan di atas
  }
}

/**
 * Kait opsional untuk lapisan UI: dipanggil saat sebuah job menyerah.
 *
 * Dipakai memunculkan peringatan dan — sejak M15 — menulis
 * `pos_security_events` bertipe `*_RECEIPT_PRINT_FAILED`. Dibiarkan sebagai
 * kait alih-alih dipanggil langsung agar `lib/` tetap bebas dari lapisan di
 * atasnya ([05 §1.1.1 butir 4]).
 */
let onAbandoned: ((job: PrintJob, reason: string) => void) | undefined

export function setOnPrintAbandoned(handler: (job: PrintJob, reason: string) => void): () => void {
  onAbandoned = handler
  return () => {
    onAbandoned = undefined
  }
}

/* ── Cetak ulang ──────────────────────────────────────────────────────────── */

/**
 * Mengembalikan job ke antrean dan mencoba mengirimnya lagi.
 *
 * Memakai payload TERSIMPAN — lihat catatan pada `requeuePrintJob`.
 */
export async function retryPrintJob(jobId: string): Promise<void> {
  try {
    // Dibaca SEBELUM di-requeue: statusnya adalah satu-satunya cara memisahkan
    // cetak ULANG dari percobaan pertama yang tertunda. Job `FAILED` yang belum
    // pernah menghasilkan kertas bukan cetak ulang — mencatatnya sebagai
    // `RECEIPT_REPRINTED` akan membuat laporan pemilik penuh cetak ulang palsu
    // dan menenggelamkan yang sungguhan.
    const before = await getPrintJob(jobId)

    await requeuePrintJob(jobId)
    await refreshPrintQueue()
    await flushPrintQueue()

    if (before?.status === 'PRINTED') {
      const after = await getPrintJob(jobId)
      if (after?.status === 'PRINTED') {
        await recordSecurityEvent({
          eventType: SECURITY_EVENT.RECEIPT_REPRINTED,
          details: {
            print_job_id: jobId,
            kind: before.kind,
            ref_type: before.ref_type,
            ref_id: before.ref_id,
          },
        })
      }
    }
  } catch {
    void refreshPrintQueue()
  }
}

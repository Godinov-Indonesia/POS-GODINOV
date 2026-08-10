/**
 * Jalur 4 — Browser print. docs/05 §1.7.5.
 *
 * **Fallback universal**: satu-satunya jalur yang tersedia di setiap platform,
 * termasuk iPad/Safari. Karena `window.print()` tidak menerima byte ESC/POS,
 * adapter ini bekerja dari teks struk, bukan dari payload biner.
 */

import type { PrinterStatus, ReceiptPrinter } from '@/lib/printer/types'
import { toAscii } from '@/lib/printer/escpos'

export class BrowserPrintAdapter implements ReceiptPrinter {
  readonly kind = 'browser-print' as const
  readonly label = 'Dialog cetak peramban'

  private status: PrinterStatus = { state: 'ready' }

  isSupported(): boolean {
    return typeof window !== 'undefined'
  }

  getStatus(): PrinterStatus {
    return this.status
  }

  async connect(): Promise<void> {
    this.status = { state: 'ready' }
  }

  /**
   * Byte ESC/POS dipulihkan menjadi teks dengan membuang urutan kontrol.
   * Hasilnya tidak seindah cetak termal, tetapi struknya terbaca — dan itu
   * lebih baik daripada tidak ada jalur cetak sama sekali.
   */
  async print(payload: Uint8Array): Promise<void> {
    if (typeof window === 'undefined') throw new Error('Cetak hanya tersedia di peramban')

    this.status = { state: 'printing' }
    try {
      const text = stripEscPos(payload)
      const frame = document.createElement('iframe')
      frame.setAttribute('aria-hidden', 'true')
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
      document.body.appendChild(frame)

      const doc = frame.contentDocument
      if (!doc) throw new Error('Gagal menyiapkan dokumen cetak')

      doc.open()
      doc.write(
        `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Struk</title>` +
          `<style>@page{margin:4mm}body{margin:0}pre{font:12px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap}</style>` +
          `</head><body><pre>${escapeHtml(text)}</pre></body></html>`,
      )
      doc.close()

      frame.contentWindow?.focus()
      frame.contentWindow?.print()

      // Melepas iframe terlalu cepat membatalkan dialog cetak di sebagian
      // peramban; jeda ini murni praktis.
      setTimeout(() => frame.remove(), 1_000)
      this.status = { state: 'ready' }
    } catch (error) {
      this.status = {
        state: 'error',
        message: error instanceof Error ? error.message : 'Gagal mencetak',
      }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    this.status = { state: 'ready' }
  }
}

/** Membuang byte kontrol ESC/POS, menyisakan teks yang dapat dibaca. */
function stripEscPos(payload: Uint8Array): string {
  const out: string[] = []

  for (let i = 0; i < payload.length; i += 1) {
    const byte = payload[i]

    // ESC (0x1b) dan GS (0x1d) diikuti 1-2 byte parameter pada perintah yang
    // dipakai renderer ini. Melewatinya cukup untuk menghasilkan teks bersih.
    if (byte === 0x1b || byte === 0x1d) {
      i += payload[i + 1] === 0x21 || payload[i + 1] === 0x56 ? 2 : 1
      continue
    }

    if (byte === 0x0a) {
      out.push('\n')
      continue
    }
    if (byte >= 0x20 && byte <= 0x7e) out.push(String.fromCharCode(byte))
  }

  return toAscii(out.join(''))
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

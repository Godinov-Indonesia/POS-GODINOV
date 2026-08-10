/**
 * Jalur 2 — Network / LAN printer (Epson ePOS-Print). docs/05 §1.7.3.
 *
 * ⚠️ **Mixed content.** Bila aplikasi dilayani lewat HTTPS sementara printer
 * hanya berbicara HTTP di jaringan lokal, peramban memblokir request-nya dan
 * tidak ada cara mengakalinya dari sisi klien. Ini batasan platform, bukan bug
 * — sampaikan apa adanya ke operator ([05 §1.7.6]).
 */

import type { PrinterStatus, ReceiptPrinter } from '@/lib/printer/types'

const TIMEOUT_MS = 8_000

export class LanEposAdapter implements ReceiptPrinter {
  readonly kind = 'lan-epos' as const
  readonly label = 'Printer jaringan (LAN)'

  private status: PrinterStatus = { state: 'disconnected' }

  constructor(private readonly host: string) {}

  isSupported(): boolean {
    if (typeof window === 'undefined' || !this.host) return false
    // Halaman HTTPS tidak dapat menghubungi endpoint HTTP printer.
    return !(window.location.protocol === 'https:' && !this.host.startsWith('https://'))
  }

  getStatus(): PrinterStatus {
    if (!this.host) return { state: 'unavailable', reason: 'Alamat printer belum diatur' }
    if (!this.isSupported()) {
      return {
        state: 'unavailable',
        reason:
          'Halaman HTTPS tidak dapat menghubungi printer HTTP di jaringan lokal (mixed content)',
      }
    }
    return this.status
  }

  async connect(): Promise<void> {
    this.status = { state: 'ready' }
  }

  /**
   * ePOS-Print menerima XML. Byte ESC/POS mentah dikirim sebagai perintah
   * `<command>` ber-base64 supaya renderer yang sama dapat dipakai ulang
   * tanpa jalur render kedua.
   */
  async print(payload: Uint8Array): Promise<void> {
    if (!this.isSupported()) throw new Error(this.getStatus().state)

    this.status = { state: 'printing' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const endpoint = this.host.startsWith('http')
        ? `${this.host}/cgi-bin/epos/service.cgi?devid=local_printer`
        : `http://${this.host}/cgi-bin/epos/service.cgi?devid=local_printer`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body:
          `<?xml version="1.0" encoding="utf-8"?>` +
          `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>` +
          `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">` +
          `<command>${toBase64(payload)}</command>` +
          `</epos-print></s:Body></s:Envelope>`,
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`Printer menolak permintaan (${response.status})`)
      this.status = { state: 'ready' }
    } catch (error) {
      this.status = {
        state: 'error',
        message: error instanceof Error ? error.message : 'Gagal mencetak',
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async disconnect(): Promise<void> {
    this.status = { state: 'disconnected' }
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Jalur 3 — Fallback RawBT (Android). docs/05 §1.7.4.
 *
 * RawBT adalah aplikasi Android yang menerima byte lewat skema URL `rawbt:`.
 * Berguna ketika Web Bluetooth gagal berpasangan dengan printer merek tertentu.
 *
 * ⚠️ **Tidak ada umpan balik.** Skema URL bersifat satu arah: kita tidak pernah
 * tahu apakah kertas benar-benar keluar. Karena itu status selalu kembali ke
 * `ready`, dan UI tidak boleh mengklaim cetak berhasil.
 */

import type { PrinterStatus, ReceiptPrinter } from '@/lib/printer/types'

export class RawBtAdapter implements ReceiptPrinter {
  readonly kind = 'rawbt' as const
  readonly label = 'RawBT (Android)'

  private status: PrinterStatus = { state: 'disconnected' }

  isSupported(): boolean {
    if (typeof navigator === 'undefined') return false
    return /Android/i.test(navigator.userAgent)
  }

  getStatus(): PrinterStatus {
    if (!this.isSupported()) {
      return { state: 'unavailable', reason: 'RawBT hanya tersedia di Android' }
    }
    return this.status
  }

  async connect(): Promise<void> {
    this.status = { state: 'ready' }
  }

  async print(payload: Uint8Array): Promise<void> {
    if (!this.isSupported()) throw new Error('RawBT hanya tersedia di Android')

    let binary = ''
    for (const byte of payload) binary += String.fromCharCode(byte)
    window.location.href = `rawbt:base64,${btoa(binary)}`

    this.status = { state: 'ready' }
  }

  async disconnect(): Promise<void> {
    this.status = { state: 'disconnected' }
  }
}

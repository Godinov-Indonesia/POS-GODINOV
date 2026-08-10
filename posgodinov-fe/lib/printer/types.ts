/**
 * Kontrak printer — docs/05 §1.7.1 (ADR-07).
 *
 * Backend tidak menyediakan apa pun soal struk ([03 §14]); seluruhnya
 * tanggung jawab klien. Rancangan memisahkan dua hal yang sering tercampur:
 *
 *   Receipt (model murni)
 *         └─► ReceiptRenderer ──► Uint8Array (byte ESC/POS)   ← dapat diuji tanpa perangkat
 *                                       └─► ReceiptPrinter (transport)
 */

import type { PaymentMethod } from '@/lib/constants/payment'

export type PrinterKind = 'web-bluetooth' | 'lan-epos' | 'rawbt' | 'browser-print'

export type PrinterStatus =
  | { state: 'unavailable'; reason: string }
  | { state: 'disconnected' }
  | { state: 'connecting' }
  | { state: 'ready' }
  | { state: 'printing' }
  | { state: 'error'; message: string }

export interface ReceiptPrinter {
  readonly kind: PrinterKind
  readonly label: string
  /** Deteksi kemampuan **sinkron** — tidak boleh memicu dialog izin. */
  isSupported(): boolean
  /** Boleh memerlukan gestur pengguna (Web Bluetooth mewajibkannya). */
  connect(): Promise<void>
  print(payload: Uint8Array): Promise<void>
  disconnect(): Promise<void>
  getStatus(): PrinterStatus
}

/**
 * Lebar kolom: 58 mm ≈ 32 kolom, 80 mm ≈ 42 kolom pada Font A. Struk yang
 * dirender untuk 42 kolom akan terpotong berantakan di printer 58 mm, sehingga
 * pilihannya disimpan bersama preferensi printer.
 */
export type PrinterColumns = 32 | 42

export type PreferredPrinter = {
  kind: PrinterKind
  columns?: PrinterColumns
  /** Web Bluetooth — id perangkat yang pernah dipilih. */
  deviceId?: string
  /** LAN ePOS — host atau IP printer. */
  host?: string
}

export type ReceiptItem = {
  name: string
  qty: number
  /** sen */
  unitPrice: number
  /** sen */
  lineTotal: number
}

export type Receipt = {
  outletName: string
  outletAddress?: string
  transactionId: string
  cashierName: string
  customerName?: string
  /** ISO-8601 */
  createdAt: string
  items: ReceiptItem[]
  /** sen */
  total: number
  paymentMethod: PaymentMethod
  /** sen */
  cashReceived?: number
  /** sen */
  change?: number
  footerNote?: string
  isReprint: boolean
  isVoid: boolean
}

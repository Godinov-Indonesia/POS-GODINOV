/**
 * Registry printer — docs/05 §1.7.6.
 *
 * Urutan prioritas mengikuti kualitas pengalaman cetak, bukan kemudahan
 * implementasi. `BrowserPrintAdapter` selalu menjadi jaring terakhir karena ia
 * satu-satunya yang tersedia di setiap platform.
 */

import { getMeta, setMeta } from '@/lib/db/repositories/meta.repo'
import { BrowserPrintAdapter } from '@/lib/printer/adapters/browser-print.adapter'
import { LanEposAdapter } from '@/lib/printer/adapters/lan-epos.adapter'
import { RawBtAdapter } from '@/lib/printer/adapters/rawbt.adapter'
import { WebBluetoothAdapter } from '@/lib/printer/adapters/web-bluetooth.adapter'
import type {
  PreferredPrinter,
  PrinterColumns,
  PrinterKind,
  ReceiptPrinter,
} from '@/lib/printer/types'

const PRIORITY: PrinterKind[] = ['web-bluetooth', 'lan-epos', 'rawbt', 'browser-print']

export function createAdapter(preferred: PreferredPrinter): ReceiptPrinter {
  switch (preferred.kind) {
    case 'web-bluetooth':
      return new WebBluetoothAdapter()
    case 'lan-epos':
      return new LanEposAdapter(preferred.host ?? '')
    case 'rawbt':
      return new RawBtAdapter()
    case 'browser-print':
      return new BrowserPrintAdapter()
  }
}

export async function getPreferredPrinter(): Promise<PreferredPrinter | undefined> {
  return getMeta<PreferredPrinter>('printer.preferred')
}

export const savePreferredPrinter = (preferred: PreferredPrinter): Promise<void> =>
  setMeta('printer.preferred', preferred)

export async function getPrinterColumns(): Promise<PrinterColumns> {
  // 32 kolom (58 mm) sebagai default: struk 32 kolom tetap terbaca di printer
  // 80 mm, sedangkan sebaliknya terpotong berantakan.
  return (await getPreferredPrinter())?.columns ?? 32
}

/** Mengembalikan adapter yang paling mungkin bekerja pada perangkat ini. */
export async function resolvePrinter(): Promise<ReceiptPrinter> {
  const saved = await getPreferredPrinter()
  if (saved) {
    const adapter = createAdapter(saved)
    if (adapter.isSupported()) return adapter
  }

  for (const kind of PRIORITY) {
    const adapter = createAdapter({ kind })
    if (adapter.isSupported()) return adapter
  }

  return new BrowserPrintAdapter() // selalu ada
}

export function listAdapters(host?: string): ReceiptPrinter[] {
  return [
    new WebBluetoothAdapter(),
    new LanEposAdapter(host ?? ''),
    new RawBtAdapter(),
    new BrowserPrintAdapter(),
  ]
}

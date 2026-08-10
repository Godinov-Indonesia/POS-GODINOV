/**
 * Renderer struk — docs/05 §1.7.1.
 *
 * **Murni**: `Receipt` → byte ESC/POS. Tidak menyentuh DOM, tidak menyentuh
 * jaringan, tidak menyentuh Dexie. Itulah yang membuatnya dapat diuji tanpa
 * perangkat printer sama sekali.
 */

import { PAYMENT_METHOD_LABELS } from '@/lib/constants/payment'
import { formatIdr } from '@/lib/money'
import { concatBytes, divider, encodeText, ESCPOS, truncate, twoColumns } from '@/lib/printer/escpos'
import { formatDateTimeId } from '@/lib/time'
import type { PrinterColumns, Receipt } from '@/lib/printer/types'

/** `formatIdr` menghasilkan `Rp 22.000`; NBSP tidak ada di CP437. */
const money = (minor: number): string => formatIdr(minor).replace(/ /g, ' ')

export function renderReceipt(
  receipt: Receipt,
  opts: { columns: PrinterColumns } = { columns: 32 },
): Uint8Array {
  const { columns } = opts
  const parts: Uint8Array[] = [ESCPOS.INIT, ESCPOS.CODEPAGE_CP437]

  // ── Kepala ──────────────────────────────────────────────────────────────
  parts.push(ESCPOS.ALIGN_CENTER, ESCPOS.BOLD_ON, ESCPOS.DOUBLE_HEIGHT)
  parts.push(encodeText(`${truncate(receipt.outletName, columns)}\n`))
  parts.push(ESCPOS.NORMAL_SIZE, ESCPOS.BOLD_OFF)

  if (receipt.outletAddress) {
    parts.push(encodeText(`${truncate(receipt.outletAddress, columns)}\n`))
  }

  // Penanda cetak ulang dan void wajib menonjol: struk void yang terlihat sama
  // dengan struk normal adalah celah sengketa dengan pelanggan.
  if (receipt.isVoid) {
    parts.push(ESCPOS.BOLD_ON, encodeText('*** TRANSAKSI DIBATALKAN ***\n'), ESCPOS.BOLD_OFF)
  }
  if (receipt.isReprint) {
    parts.push(encodeText('--- CETAK ULANG ---\n'))
  }

  parts.push(ESCPOS.ALIGN_LEFT, encodeText(divider(columns)))
  parts.push(encodeText(twoColumns('No.', shortId(receipt.transactionId), columns)))
  parts.push(encodeText(twoColumns('Waktu', formatDateTimeId(receipt.createdAt), columns)))
  parts.push(encodeText(twoColumns('Kasir', truncate(receipt.cashierName, 16), columns)))
  if (receipt.customerName) {
    parts.push(encodeText(twoColumns('Pelanggan', truncate(receipt.customerName, 16), columns)))
  }
  parts.push(encodeText(divider(columns)))

  // ── Item ────────────────────────────────────────────────────────────────
  for (const item of receipt.items) {
    // Nama pada barisnya sendiri: memaksanya berbagi baris dengan nominal
    // membuat nama panjang terpotong justru pada bagian yang membedakannya.
    parts.push(encodeText(`${truncate(item.name, columns)}\n`))
    parts.push(
      encodeText(
        twoColumns(`  ${item.qty} x ${money(item.unitPrice)}`, money(item.lineTotal), columns),
      ),
    )
  }

  // ── Total ───────────────────────────────────────────────────────────────
  parts.push(encodeText(divider(columns)))
  parts.push(ESCPOS.BOLD_ON, encodeText(twoColumns('TOTAL', money(receipt.total), columns)), ESCPOS.BOLD_OFF)
  parts.push(
    encodeText(twoColumns('Metode', PAYMENT_METHOD_LABELS[receipt.paymentMethod], columns)),
  )

  if (receipt.cashReceived !== undefined) {
    parts.push(encodeText(twoColumns('Tunai', money(receipt.cashReceived), columns)))
    parts.push(encodeText(twoColumns('Kembalian', money(receipt.change ?? 0), columns)))
  }

  // ── Kaki ────────────────────────────────────────────────────────────────
  parts.push(encodeText(divider(columns)))
  parts.push(ESCPOS.ALIGN_CENTER)
  parts.push(encodeText(`${truncate(receipt.footerNote ?? 'Terima kasih', columns)}\n`))

  parts.push(ESCPOS.FEED(3), ESCPOS.CUT)

  return concatBytes(parts)
}

const shortId = (uuid: string): string => uuid.replace(/-/g, '').slice(0, 8).toUpperCase()

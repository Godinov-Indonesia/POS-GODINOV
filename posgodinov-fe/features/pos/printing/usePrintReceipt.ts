'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { getBoundOutletLabel } from '@/lib/auth/device-session'
import type { LocalTransaction } from '@/lib/db/models'
import { renderReceipt } from '@/lib/printer/receipt-renderer'
import { getPrinterColumns, resolvePrinter } from '@/lib/printer/registry'
import type { Receipt } from '@/lib/printer/types'

/**
 * Mencetak struk dari transaksi lokal.
 *
 * ⚠️ **Kegagalan cetak tidak pernah menyentuh data transaksi** ([05 §1.6.5]).
 * Transaksi sudah tersimpan di Dexie sebelum fungsi ini dipanggil; yang terjadi
 * di sini paling buruk hanyalah toast galat dan tawaran mencetak ulang.
 */
export function usePrintReceipt() {
  const cashierName = usePosAuthStore((s) => s.staffName)
  const [printing, setPrinting] = React.useState(false)

  const print = React.useCallback(
    async (transaction: LocalTransaction, options: { isReprint?: boolean } = {}) => {
      setPrinting(true)
      try {
        const [outletName, columns, printer] = await Promise.all([
          getBoundOutletLabel(),
          getPrinterColumns(),
          resolvePrinter(),
        ])

        const receipt: Receipt = {
          outletName: outletName ?? 'POS Godinov',
          transactionId: transaction.id,
          cashierName: cashierName ?? '-',
          customerName: transaction.customer_name || undefined,
          createdAt: transaction.client_created_at,
          items: transaction.items.map((item) => ({
            name: item._product_name,
            qty: item.quantity,
            unitPrice: item.unit_price,
            lineTotal: item.unit_price * item.quantity,
          })),
          total: transaction.total_amount,
          paymentMethod: transaction.payment_method,
          cashReceived: transaction._cash_received,
          change: transaction._change,
          isReprint: options.isReprint ?? false,
          isVoid: transaction.status === 'CANCELLED',
        }

        const payload = renderReceipt(receipt, { columns })

        // Adapter yang memerlukan pemasangan (Web Bluetooth) menuntut gestur
        // pengguna; fungsi ini memang selalu dipanggil dari handler klik.
        await printer.connect()
        await printer.print(payload)

        toast.success('Struk dikirim ke printer')
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Gagal mencetak: ${error.message}`
            : 'Gagal mencetak struk. Transaksi tetap tersimpan.',
        )
      } finally {
        setPrinting(false)
      }
    },
    [cashierName],
  )

  return { print, printing }
}

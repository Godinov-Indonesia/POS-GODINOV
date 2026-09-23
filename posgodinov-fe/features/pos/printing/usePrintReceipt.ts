'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { getBoundOutletLabel } from '@/lib/auth/device-session'
import type { LocalTransaction } from '@/lib/db/models'
import { enqueueSaleReceipt } from '@/lib/printer/print-queue'
import type { Receipt } from '@/lib/printer/types'

/**
 * Mencetak struk penjualan **lewat antrean** ([11 §M14.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA TIDAK LAGI MENCETAK LANGSUNG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Versi sebelumnya merender lalu mengirim di tempat, dan kegagalannya berakhir
 * sebagai toast merah yang hilang dalam tiga detik. Konsekuensinya dua:
 *
 *  1. Struk yang gagal tercetak **tidak meninggalkan jejak apa pun** — tidak
 *     ada yang dapat dicetak ulang, dan tidak ada yang memberi tahu kasir.
 *  2. `receipt_printed_at` tidak pernah terisi, sehingga diskriminator Void vs
 *     Retur (butir 15) tidak pernah berpindah dari `null`. Seluruh transaksi
 *     tetap berada di wilayah Void selamanya — persis lubang yang v2 dibangun
 *     untuk menutupnya.
 *
 * Antrean memperbaiki keduanya: payload tersimpan, percobaan diulang otomatis,
 * dan baris sumbernya ditandai tepat saat kertas benar-benar terbit.
 *
 * ⚠️ **Kegagalan cetak tidak pernah menyentuh data transaksi** (aturan R6).
 * Transaksi sudah tersimpan di Dexie sebelum fungsi ini dipanggil.
 */
export function usePrintReceipt() {
  const cashierName = usePosAuthStore((s) => s.staffName)
  const [printing, setPrinting] = React.useState(false)

  const print = React.useCallback(
    async (transaction: LocalTransaction, options: { isReprint?: boolean } = {}) => {
      setPrinting(true)
      try {
        const outletName = await getBoundOutletLabel()

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
          isVoid: transaction.status === 'VOIDED' || transaction.status === 'CANCELLED',
        }

        const job = await enqueueSaleReceipt(transaction.id, receipt)

        toast[job ? 'success' : 'error'](
          job
            ? 'Struk dikirim ke printer'
            : 'Struk gagal diantrekan. Transaksi tetap tersimpan.',
        )
      } finally {
        setPrinting(false)
      }
    },
    [cashierName],
  )

  return { print, printing }
}

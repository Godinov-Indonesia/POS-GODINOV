'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Printer } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { usePrintReceipt } from '@/features/pos/printing/usePrintReceipt'
import { posNavigate, usePosParams } from '@/features/pos/router/usePosRouter'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants/payment'
import { getTransaction } from '@/lib/db/repositories/transaction.repo'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-07 Struk — docs/05 §1.6.5.
 *
 * Transaksi **sudah tersimpan** saat layar ini muncul. Kegagalan cetak tidak
 * boleh membatalkannya: printer mati adalah masalah operasional, bukan alasan
 * menghilangkan penjualan yang uangnya sudah diterima. Karena itu ada tombol
 * "Cetak Ulang" dan tidak ada jalur yang menghapus transaksi dari sini.
 */
export function ReceiptScreen() {
  const params = usePosParams()
  const transactionId = params.transactionId
  const { print, printing } = usePrintReceipt()
  const [printed, setPrinted] = React.useState(false)

  const transaction = useLiveQuery(
    () => (transactionId ? getTransaction(transactionId) : undefined),
    [transactionId],
    undefined,
  )

  if (!transactionId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Button variant="primary" size="xl" onClick={() => posNavigate('register')}>
          Kembali ke Kasir
        </Button>
      </div>
    )
  }

  if (!transaction) return <Skeleton className="m-4 h-96 w-[24rem]" />

  const onPrint = async () => {
    await print(transaction, { isReprint: printed })
    // Cetakan kedua dan seterusnya ditandai "CETAK ULANG" pada struk, supaya
    // salinan ganda tidak dapat dipakai sebagai dua bukti transaksi berbeda.
    setPrinted(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2 text-success-text">
        <Check className="size-6" aria-hidden="true" />
        <span className="text-pos-lg font-bold">TRANSAKSI TERSIMPAN</span>
      </div>

      <div className="w-[24rem] max-w-full rounded-xl border border-border bg-surface p-4 font-mono text-pos-sm">
        <div className="flex flex-col items-center gap-0.5 border-b border-dashed border-border pb-2">
          <span className="text-pos-base font-bold">POS GODINOV</span>
          <Num>{shortId(transaction.id)}</Num>
          <span className="text-fg-muted">{formatDateTimeId(transaction.client_created_at)}</span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-dashed border-border py-2">
          {transaction.items.map((item) => (
            <li key={item.id} className="flex flex-col">
              <span>{item._product_name}</span>
              <span className="flex justify-between text-fg-muted">
                <Num>
                  {item.quantity} × <Money minor={item.unit_price} size="sm" tone="muted" />
                </Num>
                <Money minor={item.unit_price * item.quantity} size="sm" />
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 py-2">
          <Row label="Total">
            <Money minor={transaction.total_amount} size="md" />
          </Row>
          <Row label="Metode">
            <span>{PAYMENT_METHOD_LABELS[transaction.payment_method]}</span>
          </Row>
          {transaction._cash_received !== undefined ? (
            <>
              <Row label="Tunai">
                <Money minor={transaction._cash_received} size="sm" />
              </Row>
              <Row label="Kembalian">
                <Money minor={transaction._change ?? 0} size="md" tone="success" />
              </Row>
            </>
          ) : null}
          {transaction.customer_name ? (
            <Row label="Pelanggan">
              <span>{transaction.customer_name}</span>
            </Row>
          ) : null}
        </div>

        <p className="border-t border-dashed border-border pt-2 text-center text-fg-muted">
          Terima kasih
        </p>
      </div>

      <div className="flex w-[24rem] max-w-full items-center gap-2">
        <Button variant="neutral" size="xl" onClick={onPrint} disabled={printing}>
          <Printer className="size-5" aria-hidden="true" />
          {printing ? 'Mencetak…' : printed ? 'Cetak Ulang' : 'Cetak'}
        </Button>
        <Button
          variant="primary"
          size="xl"
          className="flex-1"
          onClick={() => posNavigate('register')}
        >
          TRANSAKSI BARU
        </Button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      {children}
    </div>
  )
}

'use client'

import { Ban, Check, Receipt } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toastApiError } from '@/components/ui/toaster'
import { useProducts } from '@/features/admin/products/hooks/useProducts'
import {
  DateRangePicker,
  ServerTimeBanner,
} from '@/features/admin/reports/components/DateRangePicker'
import { useDateRange, useTransactionReport } from '@/features/admin/reports/hooks/useReports'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants/payment'
import { formatDateTimeId, isRangeWithinLimit } from '@/lib/time'

/** D-21 Laporan Transaksi — docs/04 §B.1. */
export function TransactionReport() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Laporan Transaksi" description="Riwayat penjualan beserta rincian item." />
      <OutletGuard>{(outletId) => <ReportContent outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function ReportContent({ outletId }: { outletId: string }) {
  const [range, setRange] = useDateRange(7)
  const { data, isPending, error } = useTransactionReport(outletId, range)
  const { data: products } = useProducts(outletId)
  const [expanded, setExpanded] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat laporan transaksi')
  }, [error])

  // Item transaksi hanya membawa `product_id`; nama produk digabungkan di sini
  // dari katalog Admin ([03 §11.2]).
  const productNameById = React.useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p.name])),
    [products],
  )

  const rangeValid = isRangeWithinLimit(range)

  return (
    <div className="flex flex-col gap-4">
      <DateRangePicker value={range} onChange={setRange} />
      <ServerTimeBanner />

      {!rangeValid ? (
        <Banner tone="warning">Persempit rentang tanggal untuk memuat data.</Banner>
      ) : isPending ? (
        <SkeletonTable />
      ) : !data?.length ? (
        <EmptyState
          icon={Receipt}
          title="Tidak ada transaksi pada rentang ini"
          description="Ingat bahwa filter memakai waktu tiba di server. Transaksi kasir yang belum tersinkronisasi belum akan muncul di sini."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>No. Transaksi</TH>
              <TH>Waktu kasir</TH>
              <TH>Diterima server</TH>
              <TH>Pelanggan</TH>
              <TH>Metode</TH>
              <TH>Status</TH>
              <TH numeric>Total</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((transaction) => (
              <React.Fragment key={transaction.id}>
                <TR
                  className="cursor-pointer"
                  onClick={() =>
                    setExpanded((prev) => (prev === transaction.id ? null : transaction.id))
                  }
                >
                  <TD>
                    <Num className="font-semibold">{shortId(transaction.id)}</Num>
                  </TD>
                  <TD className="text-fg-muted">
                    {formatDateTimeId(transaction.client_created_at)}
                  </TD>
                  <TD className="text-fg-muted">{formatDateTimeId(transaction.created_at)}</TD>
                  <TD>{transaction.customer_name || '—'}</TD>
                  <TD>
                    {PAYMENT_METHOD_LABELS[transaction.payment_method as PaymentMethod] ??
                      transaction.payment_method}
                  </TD>
                  <TD>
                    {transaction.status === 'COMPLETED' ? (
                      <Badge tone="success" icon={Check}>
                        Selesai
                      </Badge>
                    ) : (
                      <Badge tone="danger" icon={Ban}>
                        Dibatalkan
                      </Badge>
                    )}
                  </TD>
                  <TD numeric>
                    <Money
                      minor={transaction.total_amount_minor}
                      size="sm"
                      tone={transaction.status === 'CANCELLED' ? 'muted' : 'default'}
                    />
                  </TD>
                </TR>

                {expanded === transaction.id ? (
                  <TR>
                    <TD colSpan={7} className="bg-bg-muted">
                      <div className="flex flex-col gap-1.5 p-1">
                        {transaction.cancel_notes ? (
                          <p className="text-pos-sm text-danger">
                            Alasan pembatalan: {transaction.cancel_notes}
                          </p>
                        ) : null}

                        {transaction.items.length === 0 ? (
                          <p className="text-pos-sm text-fg-muted">Tidak ada rincian item.</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {transaction.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between gap-3 text-pos-sm"
                              >
                                <span>
                                  {productNameById.get(item.product_id) ?? (
                                    <span className="text-fg-muted">
                                      Produk terhapus ({shortId(item.product_id)})
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-3">
                                  <Num className="text-fg-muted">×{item.quantity}</Num>
                                  <Money minor={item.unit_price_minor} size="sm" tone="muted" />
                                  <Money minor={item.unit_price_minor * item.quantity} size="sm" />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </TD>
                  </TR>
                ) : null}
              </React.Fragment>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

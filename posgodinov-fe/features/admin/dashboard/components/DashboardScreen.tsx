'use client'

import { Rocket, Store } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toastApiError } from '@/components/ui/toaster'
import { useActiveOutlet, useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import {
  DateRangePicker,
  ServerTimeBanner,
} from '@/features/admin/reports/components/DateRangePicker'
import { useDashboard, useDateRange } from '@/features/admin/reports/hooks/useReports'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { isRangeWithinLimit } from '@/lib/time'

/** D-03 Dashboard — docs/06 §3.8. */
export function DashboardScreen() {
  const { data: outlets, isPending } = useOutlets()
  const activeOutlet = useActiveOutlet()

  if (!isPending && !outlets?.length) {
    return (
      <EmptyState
        icon={Store}
        title="Belum ada outlet"
        description="Outlet adalah wadah bagi seluruh kategori, produk, bahan baku, dan staff. Buat satu outlet untuk mulai memakai dashboard."
        action={
          <Link href="/admin/outlets/new" className={buttonVariants({ variant: 'primary' })}>
            Tambah Outlet
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description={
          activeOutlet ? `Ringkasan penjualan ${activeOutlet.name}.` : 'Ringkasan penjualan.'
        }
        action={
          <Link href="/admin/onboarding" className={buttonVariants({ variant: 'neutral' })}>
            <Rocket className="size-4" aria-hidden="true" />
            Panduan Setup
          </Link>
        }
      />

      <OutletGuard>{(outletId) => <DashboardContent outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function DashboardContent({ outletId }: { outletId: string }) {
  const [range, setRange] = useDateRange(7)
  const { data, isPending, error } = useDashboard(outletId, range)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat dashboard')
  }, [error])

  const rangeValid = isRangeWithinLimit(range)

  return (
    <div className="flex flex-col gap-4">
      <DateRangePicker value={range} onChange={setRange} />
      <ServerTimeBanner />

      {!rangeValid ? (
        <Banner tone="warning">
          Persempit rentang tanggal untuk memuat data.
        </Banner>
      ) : isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total penjualan"
              value={<Money minor={data?.totalRevenueMinor ?? 0} size="xl" />}
              hint="Transaksi berstatus COMPLETED."
            />
            <StatCard
              label="Jumlah transaksi"
              value={
                <Num className="text-pos-xl font-semibold">{data?.totalTransactions ?? 0}</Num>
              }
            />
            <StatCard
              label="Item waste kasir"
              value={<Num className="text-pos-xl font-semibold">{data?.totalWasteItems ?? 0}</Num>}
              hint="Jumlah item produk jadi — bukan Rupiah, dan tidak mencakup waste bahan baku."
            />
            <StatCard
              label="Selisih kas laci"
              value={
                <Money
                  minor={data?.totalDiscrepancyMinor ?? 0}
                  size="xl"
                  signed
                  tone={(data?.totalDiscrepancyMinor ?? 0) < 0 ? 'danger' : 'success'}
                />
              }
              hint="Dijumlahkan dari shift yang sudah ditutup."
            />
          </div>

          <TopProducts products={data?.topProducts ?? []} />
        </>
      )}
    </div>
  )
}

function TopProducts({
  products,
}: {
  products: { product_id: string; product_name: string; quantity_sold: number }[]
}) {
  if (!products.length) {
    return (
      <EmptyState
        title="Belum ada penjualan pada rentang ini"
        description="Angka akan muncul setelah perangkat kasir menyinkronkan transaksinya."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-pos-lg font-semibold text-fg">5 Produk Terlaris</h2>
      <Table>
        <THead>
          <TR>
            <TH className="w-12">#</TH>
            <TH>Produk</TH>
            <TH numeric>Terjual</TH>
          </TR>
        </THead>
        <TBody>
          {products.map((product, index) => (
            <TR key={product.product_id}>
              <TD>
                <Num className="text-fg-muted">{index + 1}</Num>
              </TD>
              <TD className="font-medium">{product.product_name}</TD>
              <TD numeric>
                <Num className="font-semibold">{product.quantity_sold}</Num>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

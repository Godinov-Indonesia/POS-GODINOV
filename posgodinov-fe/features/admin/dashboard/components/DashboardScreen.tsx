'use client'

import { Rocket, Store } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { toastApiError } from '@/components/ui/toaster'
import { DashboardCashierDiscrepancy } from '@/features/admin/dashboard/components/DashboardCashierDiscrepancy'
import { DashboardCharts } from '@/features/admin/dashboard/components/DashboardCharts'
import { DashboardCriticalItems } from '@/features/admin/dashboard/components/DashboardCriticalItems'
import { DashboardMetrics } from '@/features/admin/dashboard/components/DashboardMetrics'
import { DashboardTopProducts } from '@/features/admin/dashboard/components/DashboardTopProducts'
import { useCategories } from '@/features/admin/categories/hooks/useCategories'
import { useOpnameLogs, useWasteLogs } from '@/features/admin/inventory/hooks/useInventoryOps'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { useActiveOutlet, useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { useProducts } from '@/features/admin/products/hooks/useProducts'
import {
  DateRangePicker,
  ServerTimeBanner,
} from '@/features/admin/reports/components/DateRangePicker'
import {
  useDashboard,
  useDateRange,
  useShiftReconciliation,
  useTransactionReport,
} from '@/features/admin/reports/hooks/useReports'
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description={
          activeOutlet
            ? `Ringkasan performa dan kesehatan inventori di outlet ${activeOutlet.name}.`
            : 'Ringkasan performa dan inventori bisnis Anda.'
        }
        action={
          <Link href="/admin/onboarding" className={buttonVariants({ variant: 'neutral', size: 'sm' })}>
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
  const activeOutlet = useActiveOutlet()

  // 1. Core Dashboard Stats
  const {
    data: dashboard,
    isPending: isDashboardPending,
    error: dashboardError,
  } = useDashboard(outletId, range)

  // 2. Transactions Report (Payment distribution & categories)
  const {
    data: transactions,
    isPending: isTxPending,
  } = useTransactionReport(outletId, range)

  // 3. Shift Reconciliations (Cashier minus detection)
  const {
    data: shiftReconciliations,
    isPending: isShiftPending,
  } = useShiftReconciliation(outletId, range)

  // 4. Raw Materials (Stock inventory health & asset value)
  const {
    data: rawMaterials,
    isPending: isRMPending,
  } = useRawMaterials(outletId)

  // 5. Products & Categories (For category sales breakdown)
  const { data: products } = useProducts(outletId)
  const { data: categories } = useCategories(outletId)

  // 6. Opname & Waste Logs (For minus opname & waste discrepancy)
  const {
    data: opnameLogs,
    isPending: isOpnamePending,
  } = useOpnameLogs(outletId)
  const {
    data: wasteLogs,
    isPending: isWastePending,
  } = useWasteLogs(outletId)

  React.useEffect(() => {
    if (dashboardError) toastApiError(dashboardError, 'Gagal memuat dashboard')
  }, [dashboardError])

  const rangeValid = isRangeWithinLimit(range)

  // Negative Opnames Count for Metrics Badge
  const negativeOpnameCount = React.useMemo(() => {
    return (opnameLogs ?? []).filter((l) => l.difference < 0).length
  }, [opnameLogs])

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. KPI Metrics Grid ────────────────────────────────────────── */}
      <DashboardMetrics
        dashboard={dashboard}
        rawMaterials={rawMaterials}
        negativeOpnameCount={negativeOpnameCount}
        isPending={isDashboardPending || isRMPending}
      />

      {/* ── 2. Analisis & Visualisasi ─────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-pos-md font-semibold text-fg">Analisis & Visualisasi</h2>
            <p className="text-pos-xs text-fg-muted">
              Grafik metode pembayaran, penjualan per kategori, dan kesehatan stok
            </p>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </div>

        <ServerTimeBanner />

        {!rangeValid ? (
          <Banner tone="warning">
            Persempit rentang tanggal untuk memuat data dashboard (maksimal 7 hari).
          </Banner>
        ) : (
          <DashboardCharts
            transactions={transactions}
            rawMaterials={rawMaterials}
            products={products}
            categories={categories}
            isPending={isTxPending || isRMPending}
          />
        )}
      </div>

          {/* ── 3. Top Products & Cashier Minus Detection ───────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <DashboardTopProducts
              products={dashboard?.topProducts ?? []}
              isPending={isDashboardPending}
            />

            <DashboardCashierDiscrepancy
              shifts={shiftReconciliations ?? []}
              isPending={isShiftPending}
            />
          </div>

          {/* ── 4. Critical Items & Negative Discrepancies ─────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-pos-md font-semibold text-fg">Pemeriksaan Inventori & Selisih</h2>
              <span className="text-pos-xs text-fg-subtle">
                Berdasarkan data stok, opname, dan waste {activeOutlet?.name ?? ''}
              </span>
            </div>
            <DashboardCriticalItems
              opnameLogs={opnameLogs}
              rawMaterials={rawMaterials}
              wasteLogs={wasteLogs}
              isPending={isOpnamePending || isRMPending || isWastePending}
            />
          </div>
    </div>
  )
}

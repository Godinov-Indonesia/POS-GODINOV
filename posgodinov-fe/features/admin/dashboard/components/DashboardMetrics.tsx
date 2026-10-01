'use client'

import {
  AlertCircle,
  Coins,
  DollarSign,
  Package,
  Receipt,
  Trash2,
} from 'lucide-react'
import * as React from 'react'

import { Card } from '@/components/ui/card'
import { Money, Num } from '@/components/ui/money'
import { Skeleton } from '@/components/ui/feedback'
import type { DashboardView } from '@/lib/api/endpoints/reports'
import type { RawMaterialView } from '@/lib/types/domain'

export function DashboardMetrics({
  dashboard,
  rawMaterials = [],
  negativeOpnameCount = 0,
  isPending = false,
}: {
  dashboard?: DashboardView
  rawMaterials?: RawMaterialView[]
  negativeOpnameCount?: number
  isPending?: boolean
}) {
  const totalRevenue = dashboard?.totalRevenueMinor ?? 0
  const totalTx = dashboard?.totalTransactions ?? 0
  const totalWaste = dashboard?.totalWasteItems ?? 0
  const totalDiscrepancy = dashboard?.totalDiscrepancyMinor ?? 0

  // Calculate total inventory asset value in minor
  const totalInventoryValueMinor = React.useMemo(() => {
    return rawMaterials.reduce((sum, rm) => {
      const stock = rm.stock ?? 0
      if (stock <= 0) return sum
      // cost_per_unit_minor is in sen per base unit
      return sum + Math.round(stock * rm.cost_per_unit_minor)
    }, 0)
  }, [rawMaterials])

  // Count items with stock <= 0
  const outOfStockCount = React.useMemo(() => {
    return rawMaterials.filter((rm) => (rm.stock ?? 0) <= 0).length
  }, [rawMaterials])

  // Average Order Value (AOV)
  const aovMinor = totalTx > 0 ? Math.round(totalRevenue / totalTx) : 0

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Total Penjualan */}
      <Card className="flex flex-col justify-between p-3.5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Total Penjualan</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            <DollarSign className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <Money minor={totalRevenue} size="lg" />
          <p className="mt-1 text-pos-xs text-fg-subtle">Transaksi selesai</p>
        </div>
      </Card>

      {/* 2. Jumlah Transaksi */}
      <Card className="flex flex-col justify-between p-3.5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Jumlah Transaksi</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-info/10 text-info">
            <Receipt className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <Num className="text-pos-xl font-semibold text-fg">{totalTx}</Num>
          <p className="mt-1 text-pos-xs text-fg-subtle">
            Rata-rata: <Money minor={aovMinor} size="sm" />
          </p>
        </div>
      </Card>

      {/* 3. Estimasi Nilai Stok */}
      <Card className="flex flex-col justify-between p-3.5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Nilai Stok Bahan</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-success-subtle text-success-text">
            <Package className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <Money minor={totalInventoryValueMinor} size="lg" />
          <p className="mt-1 text-pos-xs text-fg-subtle">
            {rawMaterials.length} bahan baku aktif
          </p>
        </div>
      </Card>

      {/* 4. Selisih Kas Laci */}
      <Card className="flex flex-col justify-between p-3.5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Selisih Kas Laci</span>
          <div
            className={`flex size-7 items-center justify-center rounded-lg ${
              totalDiscrepancy < 0
                ? 'bg-danger-subtle text-danger'
                : 'bg-success-subtle text-success-text'
            }`}
          >
            <Coins className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <Money
            minor={totalDiscrepancy}
            size="lg"
            signed
            tone={totalDiscrepancy < 0 ? 'danger' : 'success'}
          />
          <p className="mt-1 text-pos-xs text-fg-subtle">Dari shift tertutup</p>
        </div>
      </Card>

      {/* 5. Waste Kasir */}
      <Card className="flex flex-col justify-between p-3.5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Item Waste Kasir</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-warning-subtle text-warning-text">
            <Trash2 className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <Num className="text-pos-xl font-semibold text-fg">{totalWaste}</Num>
          <p className="mt-1 text-pos-xs text-fg-subtle">Produk jadi terbuang</p>
        </div>
      </Card>

      {/* 6. Perhatian Stok & Minus */}
      <Card
        className={`flex flex-col justify-between p-3.5 transition-all hover:shadow-md ${
          outOfStockCount > 0 || negativeOpnameCount > 0
            ? 'border-danger/40 bg-danger-subtle/30'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-pos-xs font-medium text-fg-muted">Perlu Perhatian</span>
          <div
            className={`flex size-7 items-center justify-center rounded-lg ${
              outOfStockCount > 0 || negativeOpnameCount > 0
                ? 'bg-danger text-white'
                : 'bg-bg-muted text-fg-muted'
            }`}
          >
            <AlertCircle className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <Num
              className={`text-pos-xl font-semibold ${
                outOfStockCount > 0 || negativeOpnameCount > 0
                  ? 'text-danger'
                  : 'text-fg'
              }`}
            >
              {outOfStockCount + negativeOpnameCount}
            </Num>
            <span className="text-pos-xs text-fg-muted">item</span>
          </div>
          <p className="mt-1 text-pos-xs text-fg-subtle">
            {outOfStockCount} habis • {negativeOpnameCount} minus SO
          </p>
        </div>
      </Card>
    </div>
  )
}

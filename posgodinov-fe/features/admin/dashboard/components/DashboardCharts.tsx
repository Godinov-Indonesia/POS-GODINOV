'use client'

import * as React from 'react'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { formatIdr } from '@/lib/money'
import type { ProductView, RawMaterialView } from '@/lib/types/domain'
import type { TransactionReportRow } from '@/lib/api/endpoints/reports'
import type { Category } from '@/lib/types/api'

// Color palettes conforming to Godinov visual theme
const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#059669', // Emerald
  TUNAI: '#059669',
  QRIS: '#2563EB', // Blue
  EDC: '#0284C7', // Cyan
  DEBIT: '#0284C7',
  CREDIT: '#8B5CF6', // Purple
  TRANSFER: '#D97706', // Amber
  LAINNYA: '#64748B', // Slate
}

const CATEGORY_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#8B5CF6', // Purple
  '#0284C7', // Cyan
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
]

const STOCK_STATUS_COLORS = {
  safe: '#059669', // Emerald
  warning: '#D97706', // Amber
  danger: '#DC2626', // Red
}

type PaymentSummary = {
  name: string
  key: string
  value: number
  totalAmountMinor: number
  color: string
}

type CategorySummary = {
  name: string
  value: number
  totalAmountMinor: number
  color: string
}

type StockHealthSummary = {
  name: string
  key: 'safe' | 'warning' | 'danger'
  value: number
  color: string
  description: string
}

type TooltipPayloadItem = {
  payload: {
    name: string
    value: number
    color?: string
    totalAmountMinor?: number
  }
  color?: string
}

// Custom tooltip for currency & count
function CustomDonutTooltip({
  active,
  payload,
  isCurrency = false,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  isCurrency?: boolean
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-surface-inverse px-3 py-2 text-fg-inverse shadow-xl">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: data.color || payload[0].color }}
          />
          <span className="text-pos-xs font-semibold">{data.name}</span>
        </div>
        <p className="mt-1 text-pos-xs text-fg-inverse/90">
          Jumlah: <span className="font-mono font-semibold">{data.value}</span>
        </p>
        {isCurrency && data.totalAmountMinor !== undefined ? (
          <p className="text-pos-xs text-fg-inverse/90">
            Nominal:{' '}
            <span className="font-mono font-semibold">
              {formatIdr(data.totalAmountMinor)}
            </span>
          </p>
        ) : null}
      </div>
    )
  }
  return null
}

const emptySubscribe = () => () => {}

export function DashboardCharts({
  transactions = [],
  rawMaterials = [],
  products = [],
  categories = [],
  isPending = false,
}: {
  transactions?: TransactionReportRow[]
  rawMaterials?: RawMaterialView[]
  products?: ProductView[]
  categories?: Category[]
  isPending?: boolean
}) {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  // 1. Payment Methods Breakdown
  const paymentData: PaymentSummary[] = React.useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'COMPLETED')
    const map = new Map<string, { count: number; totalMinor: number }>()

    for (const t of completed) {
      const rawMethod = (t.payment_method || 'LAINNYA').toUpperCase().trim()
      const current = map.get(rawMethod) || { count: 0, totalMinor: 0 }
      current.count += 1
      current.totalMinor += t.total_amount_minor
      map.set(rawMethod, current)
    }

    return Array.from(map.entries()).map(([method, item], index) => {
      let displayName = method
      if (method === 'CASH') displayName = 'Tunai (Cash)'
      else if (method === 'QRIS') displayName = 'QRIS'
      else if (method === 'EDC') displayName = 'Kartu / EDC'
      else if (method === 'TRANSFER') displayName = 'Transfer Bank'

      const color =
        PAYMENT_COLORS[method] ||
        CATEGORY_COLORS[index % CATEGORY_COLORS.length]

      return {
        name: displayName,
        key: method,
        value: item.count,
        totalAmountMinor: item.totalMinor,
        color,
      }
    })
  }, [transactions])

  // 2. Sales by Category
  const categoryData: CategorySummary[] = React.useMemo(() => {
    const productCategoryMap = new Map<string, string>()
    const categoryNameMap = new Map<string, string>()

    for (const c of categories) {
      categoryNameMap.set(c.id, c.name)
    }
    for (const p of products) {
      if (p.category_id) {
        productCategoryMap.set(p.id, p.category_id)
      }
    }

    const completed = transactions.filter((t) => t.status === 'COMPLETED')
    const catMap = new Map<string, { count: number; totalMinor: number }>()

    for (const t of completed) {
      for (const item of t.items) {
        const catId = productCategoryMap.get(item.product_id) || 'uncategorized'
        const catName =
          catId === 'uncategorized'
            ? 'Tanpa Kategori'
            : categoryNameMap.get(catId) || 'Lainnya'

        const current = catMap.get(catName) || { count: 0, totalMinor: 0 }
        current.count += item.quantity
        current.totalMinor += item.quantity * item.unit_price_minor
        catMap.set(catName, current)
      }
    }

    return Array.from(catMap.entries())
      .map(([name, item], index) => ({
        name,
        value: item.count,
        totalAmountMinor: item.totalMinor,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, products, categories])

  // 3. Stock Health Breakdown
  const stockHealthData: StockHealthSummary[] = React.useMemo(() => {
    let safeCount = 0
    let warningCount = 0
    let dangerCount = 0

    for (const m of rawMaterials) {
      const stock = m.stock ?? 0
      if (stock <= 0) {
        dangerCount += 1
      } else if (stock <= 10) {
        warningCount += 1
      } else {
        safeCount += 1
      }
    }

    const res: StockHealthSummary[] = []
    if (safeCount > 0 || rawMaterials.length === 0) {
      res.push({
        name: 'Stok Aman (> 10)',
        key: 'safe',
        value: safeCount,
        color: STOCK_STATUS_COLORS.safe,
        description: 'Persediaan cukup untuk operasional',
      })
    }
    if (warningCount > 0) {
      res.push({
        name: 'Stok Menipis (1-10)',
        key: 'warning',
        value: warningCount,
        color: STOCK_STATUS_COLORS.warning,
        description: 'Perlu restock dalam waktu dekat',
      })
    }
    if (dangerCount > 0) {
      res.push({
        name: 'Habis / Minus (≤ 0)',
        key: 'danger',
        value: dangerCount,
        color: STOCK_STATUS_COLORS.danger,
        description: 'Segera lakukan restock atau cek fisik',
      })
    }
    return res
  }, [rawMaterials])

  if (!mounted || isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Chart 1: Donut Metode Pembayaran */}
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-pos-md">Metode Pembayaran</CardTitle>
          <p className="text-pos-xs text-fg-muted">
            Distribusi cara pembayaran transaksi selesai
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center p-3">
          {paymentData.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center text-pos-sm text-fg-subtle">
              <span>Belum ada transaksi pada periode ini</span>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomDonutTooltip isCurrency={true} />}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2: Penjualan per Kategori */}
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-pos-md">Penjualan per Kategori</CardTitle>
          <p className="text-pos-xs text-fg-muted">
            Porsi kuantitas produk terjual berdasarkan kategori
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center p-3">
          {categoryData.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center text-pos-sm text-fg-subtle">
              <span>Belum ada produk terjual pada periode ini</span>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomDonutTooltip isCurrency={true} />}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 3: Kesehatan Stok Bahan Baku */}
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-pos-md">Status Bahan Baku</CardTitle>
          <p className="text-pos-xs text-fg-muted">
            Kesehatan persediaan {rawMaterials.length} bahan baku di outlet
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center p-3">
          {rawMaterials.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center text-pos-sm text-fg-subtle">
              <span>Belum ada bahan baku di outlet ini</span>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stockHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomDonutTooltip isCurrency={false} />}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

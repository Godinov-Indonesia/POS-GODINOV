'use client'

import { ArrowRight, Trophy } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Num } from '@/components/ui/money'
import { buttonVariants } from '@/components/ui/button'

type TopProduct = {
  product_id: string
  product_name: string
  quantity_sold: number
}

const RANK_BADGES = [
  { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: '1', emoji: '🥇' },
  { bg: 'bg-slate-100 text-slate-800 border-slate-300', label: '2', emoji: '🥈' },
  { bg: 'bg-amber-50 text-amber-900 border-amber-200', label: '3', emoji: '🥉' },
  { bg: 'bg-bg-muted text-fg-muted border-border', label: '4', emoji: '' },
  { bg: 'bg-bg-muted text-fg-muted border-border', label: '5', emoji: '' },
]

export function DashboardTopProducts({
  products = [],
  isPending = false,
}: {
  products?: TopProduct[]
  isPending?: boolean
}) {
  const maxQty = React.useMemo(() => {
    if (!products.length) return 1
    return Math.max(...products.map((p) => p.quantity_sold))
  }, [products])

  const totalSold = React.useMemo(() => {
    return products.reduce((sum, p) => sum + p.quantity_sold, 0)
  }, [products])

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-600" aria-hidden="true" />
            <CardTitle className="text-pos-md">Top 5 Produk Terlaris</CardTitle>
          </div>
          <p className="mt-0.5 text-pos-xs text-fg-muted">
            Produk dengan kuantitas penjualan tertinggi pada rentang ini
          </p>
        </div>

        <Link
          href="/admin/reports/transactions"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Lihat Transaksi
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-4 pt-0">
        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Belum ada data penjualan"
            description="Item terlaris akan muncul otomatis setelah kasir mencatat transaksi."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product, index) => {
              const badge = RANK_BADGES[index] || RANK_BADGES[4]
              const percent = maxQty > 0 ? Math.round((product.quantity_sold / maxQty) * 100) : 0
              const shareOfTop5 =
                totalSold > 0 ? Math.round((product.quantity_sold / totalSold) * 100) : 0

              return (
                <div
                  key={product.product_id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-bg-muted/40 p-2.5 transition-colors hover:bg-bg-muted/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-pos-xs font-bold ${badge.bg}`}
                      >
                        {badge.emoji ? badge.emoji : badge.label}
                      </span>
                      <span className="truncate text-pos-sm font-semibold text-fg">
                        {product.product_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Num className="text-pos-sm font-bold text-fg">
                        {product.quantity_sold}
                      </Num>
                      <span className="text-pos-xs text-fg-subtle">
                        terjual ({shareOfTop5}%)
                      </span>
                    </div>
                  </div>

                  {/* Visual progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0
                          ? 'bg-amber-500'
                          : index === 1
                            ? 'bg-blue-600'
                            : index === 2
                              ? 'bg-emerald-600'
                              : 'bg-fg-muted'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

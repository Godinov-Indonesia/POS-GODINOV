'use client'

import { ArrowRight, CheckCircle2, UserX } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { Money } from '@/components/ui/money'
import type { ShiftReconciliationView } from '@/lib/api/endpoints/reports'

type CashierDiscrepancySummary = {
  staffName: string
  totalShifts: number
  minusShiftsCount: number
  totalMinusMinor: number
  flaggedCount: number
  lastMinusMinor: number | null
}

export function DashboardCashierDiscrepancy({
  shifts = [],
  isPending = false,
}: {
  shifts?: ShiftReconciliationView[]
  isPending?: boolean
}) {
  const cashiersSummary: CashierDiscrepancySummary[] = React.useMemo(() => {
    const map = new Map<string, CashierDiscrepancySummary>()

    for (const s of shifts) {
      const key = s.staffName || 'Kasir Tanpa Nama'
      const existing = map.get(key) || {
        staffName: key,
        totalShifts: 0,
        minusShiftsCount: 0,
        totalMinusMinor: 0,
        flaggedCount: 0,
        lastMinusMinor: null,
      }

      existing.totalShifts += 1

      // Cek apakah ada selisih uang tunai negatif (cash variance < 0)
      const cashVar = s.cashVarianceMinor ?? 0
      if (cashVar < 0) {
        existing.minusShiftsCount += 1
        existing.totalMinusMinor += cashVar
        existing.lastMinusMinor = cashVar
      }

      if (s.flagged) {
        existing.flaggedCount += 1
      }

      map.set(key, existing)
    }

    // Filter hanya kasir yang pernah mengalami selisih minus
    return Array.from(map.values())
      .filter((c) => c.minusShiftsCount > 0)
      .sort((a, b) => {
        // Urutkan berdasarkan frekuensi minus terbanyak, lalu nominal minus terbesar
        if (b.minusShiftsCount !== a.minusShiftsCount) {
          return b.minusShiftsCount - a.minusShiftsCount
        }
        return a.totalMinusMinor - b.totalMinusMinor
      })
  }, [shifts])

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <UserX className="size-4 text-danger" aria-hidden="true" />
            <CardTitle className="text-pos-md">Kasir Sering Minus Kas</CardTitle>
          </div>
          <p className="mt-0.5 text-pos-xs text-fg-muted">
            Kasir dengan kekurangan uang tunai saat penutupan shift (laci kas)
          </p>
        </div>

        <Link
          href="/admin/reports/shift-reconciliation"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Rekonsiliasi Shift
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-4 pt-0">
        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : cashiersSummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-success-text" aria-hidden="true" />
            <p className="text-pos-sm font-medium text-fg">Seluruh kasir laci tertutup pas</p>
            <p className="text-pos-xs text-fg-muted max-w-sm">
              Tidak ada kasir yang mengalami kekurangan kas (minus) pada shift di rentang ini.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cashiersSummary.map((cashier, index) => {
              const avgMinus =
                cashier.minusShiftsCount > 0
                  ? Math.round(cashier.totalMinusMinor / cashier.minusShiftsCount)
                  : 0

              return (
                <div
                  key={cashier.staffName}
                  className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-subtle/20 p-3 transition-colors hover:bg-danger-subtle/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger text-pos-xs font-bold">
                      #{index + 1}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-pos-sm font-semibold text-fg">
                          {cashier.staffName}
                        </span>
                        {cashier.flaggedCount > 0 ? (
                          <Badge tone="danger">
                            {cashier.flaggedCount}x Anomali
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-pos-xs text-fg-muted">
                        <span className="font-semibold text-danger">
                          {cashier.minusShiftsCount} kali minus
                        </span>{' '}
                        dari {cashier.totalShifts} shift tertutup
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-pos-xs text-fg-muted sm:hidden">Total minus:</span>
                      <Money
                        minor={cashier.totalMinusMinor}
                        size="md"
                        tone="danger"
                        signed
                      />
                    </div>
                    <span className="text-pos-xs text-fg-subtle">
                      Rata-rata: <Money minor={avgMinus} size="sm" tone="danger" signed />
                    </span>
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

'use client'

import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import { Money, Num, formatPercent } from '@/components/ui/money'
import { calculateMargin, type HppLine } from '@/features/admin/products/lib/hpp'
import { cn } from '@/lib/utils/cn'

/**
 * Ringkasan HPP & margin — docs/06 §3.9.
 *
 * Menempel di bawah form supaya angka margin selalu terlihat saat penyusun
 * resep digulir. Margin negatif adalah **peringatan, bukan blokir**: ada produk
 * yang memang dijual rugi (paket promo, item pancingan), dan backend tidak
 * menolaknya.
 */
export function HppSummary({ lines, priceMinor }: { lines: HppLine[]; priceMinor: number }) {
  const summary = React.useMemo(
    () => calculateMargin(lines, priceMinor),
    [lines, priceMinor],
  )

  const negative = summary.marginMinor < 0

  return (
    <div
      className={cn(
        'sticky bottom-0 grid gap-px overflow-hidden rounded-xl border border-border sm:grid-cols-4',
        negative ? 'bg-danger-subtle' : 'bg-bg-muted',
      )}
    >
      <Cell label="Total HPP">
        <Money minor={summary.hppMinor} size="lg" tone={negative ? 'danger' : 'default'} />
      </Cell>

      <Cell label="Harga jual">
        <Money minor={summary.priceMinor} size="lg" tone={negative ? 'danger' : 'default'} />
      </Cell>

      <Cell label="Margin kotor">
        <Money
          minor={summary.marginMinor}
          size="lg"
          signed
          tone={negative ? 'danger' : 'success'}
        />
      </Cell>

      <Cell label="Persen margin">
        {summary.marginPercent === null ? (
          <span className="text-pos-lg text-fg-muted">—</span>
        ) : (
          <Num
            className={cn(
              'text-pos-lg font-semibold',
              negative ? 'text-danger' : 'text-success-text',
            )}
          >
            {formatPercent(summary.marginPercent)}
          </Num>
        )}
      </Cell>

      {negative ? (
        <p
          role="status"
          className="flex items-center gap-1.5 border-t border-danger/20 p-2.5 text-pos-sm text-danger sm:col-span-4"
        >
          {/* Ikon + teks, bukan warna saja ([06 §1.5]). */}
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          Harga jual berada di bawah HPP. Produk tetap dapat disimpan — pastikan ini disengaja.
        </p>
      ) : null}
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface p-3">
      <span className="text-pos-xs uppercase tracking-wide text-fg-muted">{label}</span>
      {children}
    </div>
  )
}

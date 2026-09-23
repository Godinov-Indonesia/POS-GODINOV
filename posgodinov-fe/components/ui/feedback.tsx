import { type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/** Kerangka pemuatan — docs/06 §4.9. Tidak ada animasi berdenyut yang mengganggu. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-bg-muted', className)} {...props} />
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-8 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="size-8 text-fg-subtle" aria-hidden="true" /> : null}
      <p className="text-pos-base font-semibold text-fg">{title}</p>
      {description ? <p className="max-w-prose text-pos-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

const BANNER_TONE = {
  // Amber wajib membawa teks navy, bukan putih ([06 §1.5]).
  warning: 'border-warning bg-warning-subtle text-warning-text',
  info: 'border-accent bg-accent-subtle text-accent',
  danger: 'border-danger bg-danger-subtle text-danger',
} as const

/**
 * Banner peringatan persisten — mis. catatan bahwa laporan difilter
 * `created_at`, bukan `client_created_at` ([05 §0.4]).
 */
export function Banner({
  tone = 'info',
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: keyof typeof BANNER_TONE
  icon?: LucideIcon
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="note"
      className={cn('flex gap-2.5 rounded-lg border p-3 text-pos-sm', BANNER_TONE[tone], className)}
    >
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  )
}

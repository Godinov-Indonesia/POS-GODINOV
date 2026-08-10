import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Permukaan dasar — docs/06 §6.2.
 *
 * Elevasi memakai bayangan lembut berlapis, **bukan** offset keras ala
 * brutalism (dilarang di [06 §0.3]). Tidak ada `rounded-none` pada permukaan.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-pos-lg font-semibold text-fg', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-pos-sm text-fg-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-border p-4', className)} {...props} />
  )
}

/** Kartu statistik Dashboard — nominal dirender lewat `<Money/>`, bukan teks biasa. */
export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('p-4', className)}>
      <p className="text-pos-sm text-fg-muted">{label}</p>
      <div className="mt-1">{value}</div>
      {hint ? <p className="mt-1 text-pos-xs text-fg-subtle">{hint}</p> : null}
    </Card>
  )
}

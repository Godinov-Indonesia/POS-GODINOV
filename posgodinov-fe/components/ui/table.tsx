import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Tabel Admin. Selector `table` di globals.css sudah memberi `tabular-nums`
 * ke seluruh isinya, sehingga kolom nominal tidak bergoyang ([06 §2.4]).
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className={cn('w-full border-collapse text-pos-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-bg-muted', className)} {...props} />
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-bg-muted/60', className)} {...props} />
}

export function TH({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 text-left font-semibold text-fg-muted',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn('px-3 py-2.5 align-middle text-fg', numeric && 'text-right', className)}
      {...props}
    />
  )
}

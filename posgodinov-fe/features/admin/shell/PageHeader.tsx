import * as React from 'react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-pos-xl font-bold tracking-tight text-fg">{title}</h1>
        {description ? <p className="text-pos-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

import {
  AlertTriangle,
  Check,
  CloudOff,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Badge — docs/06 §1.5.
 *
 * DUA ATURAN KONTRAS YANG LAHIR DARI TABEL RASIO, BUKAN PREFERENSI:
 * - **Amber tidak pernah membawa teks putih** (3.19:1 — gagal). Badge amber
 *   memakai `bg-warning text-fg` atau `bg-warning-subtle text-warning-text`.
 * - **Emerald putih hanya untuk teks besar.** Badge "LUNAS" kecil memakai
 *   `bg-success-subtle text-success-text` (5.48:1), bukan `bg-success`.
 *
 * Setiap status wajib punya **penanda kedua** — ikon atau teks — karena 8% pria
 * mengalami defisiensi penglihatan merah-hijau, dan sistem ini membedakan
 * "lunas" (hijau) dari "gagal" (merah) pada layar yang sama.
 */
const TONE = {
  neutral: 'bg-bg-muted text-fg-muted border-border',
  info: 'bg-accent-subtle text-accent border-accent',
  success: 'bg-success-subtle text-success-text border-success-text/30',
  warning: 'bg-warning-subtle text-warning-text border-warning-text/30',
  danger: 'bg-danger-subtle text-danger border-danger/30',
} as const

export type BadgeTone = keyof typeof TONE

export function Badge({
  tone = 'neutral',
  icon: Icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: LucideIcon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-pos-xs font-medium',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Status sinkronisasi baris POS — warna + ikon + teks, sesuai tabel [06 §1.5]. */
export type SyncState = 'synced' | 'pending' | 'failed' | 'offline'

const SYNC_PRESET: Record<SyncState, { tone: BadgeTone; icon: LucideIcon; label: string }> = {
  synced: { tone: 'success', icon: Check, label: 'Tersinkron' },
  pending: { tone: 'warning', icon: Clock, label: 'Menunggu' },
  failed: { tone: 'danger', icon: AlertTriangle, label: 'Gagal' },
  offline: { tone: 'neutral', icon: CloudOff, label: 'Offline' },
}

export function SyncBadge({ state, count }: { state: SyncState; count?: number }) {
  const preset = SYNC_PRESET[state]
  return (
    <Badge tone={preset.tone} icon={preset.icon}>
      {preset.label}
      {typeof count === 'number' ? (
        <span className="font-mono tabular-nums">{count > 99 ? '99+' : count}</span>
      ) : null}
    </Badge>
  )
}

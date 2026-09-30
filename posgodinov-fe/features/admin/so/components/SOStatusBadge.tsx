'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  Play,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { SOStatus } from '@/lib/types/inventory'

const CONFIG: Record<SOStatus, { tone: BadgeTone; label: string; icon: LucideIcon }> = {
  OPEN: { tone: 'neutral', label: 'Draft (Open)', icon: FileEdit },
  PUBLISHED: { tone: 'info', label: 'Terbit (Published)', icon: Clock },
  COUNTING: { tone: 'warning', label: 'Sedang Dihitung', icon: Play },
  CLOSED: { tone: 'warning', label: 'Menunggu Review', icon: AlertTriangle },
  APPROVED: { tone: 'success', label: 'Disetujui', icon: CheckCircle2 },
  REJECTED: { tone: 'danger', label: 'Ditolak', icon: XCircle },
}

export function SOStatusBadge({ status }: { status: SOStatus }) {
  const cfg = CONFIG[status] ?? { tone: 'neutral', label: status, icon: Clock }
  const Icon = cfg.icon
  return (
    <Badge tone={cfg.tone} icon={Icon}>
      {cfg.label}
    </Badge>
  )
}

'use client'

import { LogOut } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { OutletSwitcher } from '@/features/admin/outlets/components/OutletSwitcher'
import { hardLogout } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'

export function AdminHeader() {
  const business = useSessionStore((s) => s.business)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      <OutletSwitcher />

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-pos-sm font-medium text-fg">{business?.owner_name ?? '—'}</span>
          <span className="font-mono text-pos-xs text-fg-subtle">
            {business?.serial_business ?? ''}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Keluar"
          title="Keluar"
          onClick={() => hardLogout('logout')}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}

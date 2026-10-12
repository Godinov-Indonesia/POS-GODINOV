'use client'

import { LogOut, Menu, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { OutletSwitcher } from '@/features/admin/outlets/components/OutletSwitcher'
import { hardLogout } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'

export function AdminHeader({
  onToggleSidebar,
  isSidebarOpen = false,
}: {
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}) {
  const business = useSessionStore((s) => s.business)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6 w-full z-30">
      {onToggleSidebar ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={isSidebarOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
          title={isSidebarOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
          onClick={onToggleSidebar}
          className="shrink-0"
        >
          {isSidebarOpen ? (
            <X className="size-5 transition-transform duration-150 text-fg" aria-hidden="true" />
          ) : (
            <Menu className="size-5 transition-transform duration-150 text-fg" aria-hidden="true" />
          )}
        </Button>
      ) : null}

      <div className="flex items-center gap-2.5 mr-1 sm:mr-3 shrink-0">
        <span className="text-pos-base sm:text-pos-md font-bold tracking-tight text-fg select-none">
          POS GODINOV
        </span>
      </div>

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

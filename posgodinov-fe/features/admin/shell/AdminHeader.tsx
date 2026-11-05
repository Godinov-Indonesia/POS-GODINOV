'use client'

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { OutletSwitcher } from '@/features/admin/outlets/components/OutletSwitcher'
import { hardLogout } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'

export function AdminHeader({
  isMobileOpen = false,
  isDesktopCollapsed = false,
  onToggleMobile,
  onToggleDesktop,
}: {
  isMobileOpen?: boolean
  isDesktopCollapsed?: boolean
  onToggleMobile?: () => void
  onToggleDesktop?: () => void
}) {
  const business = useSessionStore((s) => s.business)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6 w-full z-30">
      {/* Mobile/tablet (< 1024px): drawer overlay — pola hamburger ↔ X standar. */}
      {onToggleMobile ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={isMobileOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
          title={isMobileOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
          onClick={onToggleMobile}
          className="shrink-0 lg:hidden"
        >
          {isMobileOpen ? (
            <X className="size-5 transition-transform duration-150 text-fg" aria-hidden="true" />
          ) : (
            <Menu className="size-5 transition-transform duration-150 text-fg" aria-hidden="true" />
          )}
        </Button>
      ) : null}

      {/* Desktop (≥ 1024px): panel statis yang menyusut jadi rail ikon, bukan
          drawer — ikon panel-left menghindari ambiguitas dengan hamburger. */}
      {onToggleDesktop ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDesktopCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          title={isDesktopCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          onClick={onToggleDesktop}
          className="hidden shrink-0 lg:flex"
        >
          {isDesktopCollapsed ? (
            <PanelLeftOpen className="size-5 text-fg" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-5 text-fg" aria-hidden="true" />
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

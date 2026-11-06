'use client'

import { useQuery } from '@tanstack/react-query'
import { Crown, LogOut, Menu, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { OutletSwitcher } from '@/features/admin/outlets/components/OutletSwitcher'
import { getSubscription } from '@/lib/api/endpoints/subscription'
import { hardLogout } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'

/** Inisial 1-2 huruf dari nama pemilik, untuk avatar fallback di header. */
function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

export function AdminHeader({
  isMobileOpen = false,
  onToggleMobile,
}: {
  isMobileOpen?: boolean
  onToggleMobile?: () => void
}) {
  const business = useSessionStore((s) => s.business)

  const { data: subData } = useQuery({
    queryKey: ['subscription-info'],
    queryFn: getSubscription,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const planCode =
    subData?.effective_policy?.plan_code ||
    subData?.policy?.plan_code ||
    subData?.subscription?.plan?.code ||
    subData?.subscription?.plan_code ||
    'FREE'
  const isPaidPlan = planCode.toUpperCase() !== 'FREE'

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6 w-full z-30">
      {/* Zona 1: Navigasi mobile — drawer overlay, hanya tampil < 1024px.
          Kontrol collapse desktop sengaja TIDAK diduplikasi di sini; ia
          hidup satu tempat saja (dasar sidebar) agar tidak ada dua tombol
          dengan ikon beda untuk aksi yang terasa serupa. */}
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

      {/* Zona 2: Identitas produk — logo mendapat ruang penuh di kiri header. */}
      <div className="flex items-center shrink-0">
        <Logo priority className="h-12 sm:h-17" />
      </div>

      <div className="h-8 w-px shrink-0 bg-border" aria-hidden="true" />

      {/* Zona 3: Konteks kerja aktif — outlet mana yang sedang dilihat. */}
      <OutletSwitcher />

      {/* Zona 4: Akun — didorong penuh ke kanan, dipisah separator agar
          tidak tercampur visual dengan konteks outlet di sebelahnya. */}
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/admin/subscription"
          className={
            isPaidPlan
              ? 'inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-subtle px-3 py-1.5 text-pos-xs font-semibold text-accent transition-colors hover:bg-accent/15'
              : 'inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-pos-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover'
          }
          title="Kelola & Upgrade Paket Langganan"
        >
          {isPaidPlan ? (
            <>
              <Crown className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Paket {planCode.toUpperCase()}</span>
              <span className="sm:hidden">{planCode.toUpperCase()}</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Upgrade Plan</span>
            </>
          )}
        </Link>

        <div className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

        <div className="hidden items-center gap-2.5 sm:flex">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-pos-xs font-semibold text-accent"
            aria-hidden="true"
          >
            {getInitials(business?.owner_name)}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-pos-sm font-medium text-fg">{business?.owner_name ?? '—'}</span>
            <span className="font-mono text-pos-xs text-fg-subtle">
              {business?.serial_business ?? ''}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Keluar"
          title="Keluar dari akun"
          onClick={() => hardLogout('logout')}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}

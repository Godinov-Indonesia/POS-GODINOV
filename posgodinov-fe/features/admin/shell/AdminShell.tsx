'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { useHasHydrated } from '@/components/hydration-guard'
import { Skeleton } from '@/components/ui/feedback'
import { AdminHeader } from '@/features/admin/shell/AdminHeader'
import { AdminSidebar } from '@/features/admin/shell/AdminSidebar'
import { useSessionStore } from '@/lib/auth/session-store'

/**
 * Shell Admin — docs/06 §3.8.
 *
 * Penjaga sesi hidup di sini, bukan di middleware: token disimpan di
 * `sessionStorage`/`localStorage` dan tidak pernah dikirim sebagai cookie,
 * sehingga server tidak punya cara mengetahui status login ([05 §1.4.2]).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHasHydrated()
  const status = useSessionStore((s) => s.status)

  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const [isDesktopOpen, setIsDesktopOpen] = React.useState(true)

  const toggleSidebar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileOpen((prev) => !prev)
    } else {
      setIsDesktopOpen((prev) => !prev)
    }
  }, [])

  const usable = status === 'authenticated' || status === 'refreshing'

  React.useEffect(() => {
    if (hydrated && !usable) router.replace('/login')
  }, [hydrated, usable, router])

  // Seluruh status selain `authenticated`/`refreshing` menahan render, bukan
  // hanya `unauthenticated`. Sebelumnya status `expired` lolos ke bawah:
  // shell ikut merender, `OutletSwitcher` menembak query ber-token, dan
  // galat sesi muncul sebelum pengalihan ke halaman login sempat berjalan.
  if (!hydrated || !usable) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <AdminSidebar
        isMobileOpen={isMobileOpen}
        isDesktopOpen={isDesktopOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onToggleDesktop={toggleSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col h-dvh overflow-hidden">
        <AdminHeader onToggleSidebar={toggleSidebar} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

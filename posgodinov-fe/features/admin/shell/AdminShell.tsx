'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { useHasHydrated } from '@/components/hydration-guard'
import { Skeleton } from '@/components/ui/feedback'
import { CampaignBanner } from '@/features/admin/campaigns/CampaignBanner'
import { CampaignPopup } from '@/features/admin/campaigns/CampaignPopup'
import { AdminHeader } from '@/features/admin/shell/AdminHeader'
import { AdminSidebar } from '@/features/admin/shell/AdminSidebar'
import { CustomerServiceWidget } from '@/features/admin/shell/CustomerServiceWidget'
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
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileOpen((prev) => !prev)
    } else {
      setIsDesktopOpen((prev) => !prev)
    }
  }, [])

  const isSidebarOpen = isMobile ? isMobileOpen : isDesktopOpen

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
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* 1. Carousel promo/pengumuman diletakkan di atas navbar, lebar penuh */}
      <CampaignBanner />

      {/* 2. Navbar membentang penuh hingga ujung kiri paling awal */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
      />

      {/* 3. Sidebar dan area konten berada tepat di bawah navbar */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar
          isMobileOpen={isMobileOpen}
          isDesktopOpen={isDesktopOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          onToggleDesktop={toggleSidebar}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
        <CampaignPopup />
        <CustomerServiceWidget />
      </div>
    </div>
  )
}

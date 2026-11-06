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
const SIDEBAR_COLLAPSE_KEY = 'godinov.admin.sidebar-collapsed'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHasHydrated()
  const status = useSessionStore((s) => s.status)

  // Drawer overlay (mobile/tablet < 1024px) — ditutup secara default.
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  // Rail ikon (desktop ≥ 1024px) — dipertahankan lintas sesi via localStorage,
  // sidebar tidak pernah disembunyikan total agar jejak navigasi tetap ada.
  // Lazy initializer (bukan effect) dipakai karena bagian markup yang
  // bergantung pada nilai ini baru dirender setelah `hydrated` true, jadi
  // tidak ada risiko ketidakcocokan HTML server/klien ([05 §1.4.2]).
  const [isDesktopCollapsed, setIsDesktopCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'
  })

  // Simpan preferensi setiap kali berubah.
  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, isDesktopCollapsed ? '1' : '0')
  }, [isDesktopCollapsed])

  const toggleMobileSidebar = React.useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  const toggleDesktopSidebar = React.useCallback(() => {
    setIsDesktopCollapsed((prev) => !prev)
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
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* 1. Carousel promo/pengumuman diletakkan di atas navbar, lebar penuh */}
      <CampaignBanner />

      {/* 2. Navbar membentang penuh hingga ujung kiri paling awal */}
      <AdminHeader isMobileOpen={isMobileOpen} onToggleMobile={toggleMobileSidebar} />

      {/* 3. Sidebar dan area konten berada tepat di bawah navbar */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar
          isMobileOpen={isMobileOpen}
          isCollapsed={isDesktopCollapsed}
          onCloseMobile={() => setIsMobileOpen(false)}
          onToggleCollapse={toggleDesktopSidebar}
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

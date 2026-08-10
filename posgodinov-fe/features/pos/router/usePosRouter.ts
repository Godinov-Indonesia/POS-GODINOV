'use client'

import * as React from 'react'
import { create } from 'zustand'

import { isPosScreen, type PosScreen } from '@/features/pos/router/screens'

/**
 * Router internal POS — docs/05 §1.1.3.
 *
 * Layar aktif disinkronkan ke `history.pushState` (URL `/pos#register`) agar
 * tombol *Back* perangkat tetap berfungsi — **tanpa** memicu pengambilan
 * payload RSC. Memakai router Next di sini akan membuat setiap perpindahan
 * layar bergantung jaringan, yang mustahil bagi aplikasi offline-first.
 */
type PosRouterState = {
  screen: PosScreen
  /** Payload antar-layar, mis. `transactionId` yang baru dibuat untuk P-07. */
  params: Record<string, string>
  navigate: (screen: PosScreen, params?: Record<string, string>) => void
  replace: (screen: PosScreen, params?: Record<string, string>) => void
}

export const usePosRouterStore = create<PosRouterState>((set) => ({
  screen: 'login',
  params: {},
  navigate: (screen, params = {}) => set({ screen, params }),
  replace: (screen, params = {}) => set({ screen, params }),
}))

/**
 * Selector dipisah per-field dengan sengaja. Zustand v5 membandingkan snapshot
 * dengan kesamaan referensi, sehingga selector yang membangun objek baru
 * (`(s) => ({ screen, params })`) menghasilkan render tak berujung.
 */
export const usePosScreen = (): PosScreen => usePosRouterStore((s) => s.screen)

export const usePosParams = (): Record<string, string> => usePosRouterStore((s) => s.params)

export const posNavigate = (screen: PosScreen, params?: Record<string, string>) =>
  usePosRouterStore.getState().navigate(screen, params)

/**
 * Menghubungkan store ke History API. Dipasang sekali di `PosApp`.
 *
 * Hash dipakai alih-alih path supaya service worker cukup mem-precache satu
 * dokumen `/pos` — seluruh navigasi layar tidak pernah menyentuh jaringan.
 */
export function usePosHistorySync(): void {
  const screen = usePosRouterStore((s) => s.screen)

  React.useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (isPosScreen(fromHash)) usePosRouterStore.setState({ screen: fromHash })

    const onPopState = () => {
      const next = window.location.hash.slice(1)
      if (isPosScreen(next)) usePosRouterStore.setState({ screen: next })
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  React.useEffect(() => {
    if (window.location.hash.slice(1) === screen) return
    window.history.pushState(null, '', `#${screen}`)
  }, [screen])
}

'use client'

import * as React from 'react'
import { create } from 'zustand'

import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
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
  /**
   * Bagaimana perpindahan TERAKHIR harus tercermin di History API.
   *
   * `replace` membuang entri layar sebelumnya alih-alih menumpuknya — dipakai
   * saga tutup shift supaya tombol *Back* tidak dapat kembali ke layar Tutup
   * Shift yang shift-nya sudah tidak ada lagi (butir 17, [11 §M15.4]).
   */
  historyMode: 'push' | 'replace'
  navigate: (screen: PosScreen, params?: Record<string, string>) => void
  replace: (screen: PosScreen, params?: Record<string, string>) => void
}

export const usePosRouterStore = create<PosRouterState>((set) => ({
  screen: 'login',
  params: {},
  historyMode: 'push',
  navigate: (screen, params = {}) => set({ screen, params, historyMode: 'push' }),
  replace: (screen, params = {}) => set({ screen, params, historyMode: 'replace' }),
}))

/**
 * Layar yang boleh dibuka **tanpa** sesi kasir.
 *
 * Dasar penjagaan `popstate` di bawah. Daftar ini sengaja pendek: setiap
 * tambahan adalah layar yang dapat dicapai orang asing yang menekan *Back* di
 * perangkat yang ditinggalkan terbuka di konter.
 */
const PUBLIC_SCREENS: ReadonlySet<PosScreen> = new Set<PosScreen>(['login', 'sync-master'])

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
 * Berpindah layar **tanpa meninggalkan jejak** di riwayat browser.
 *
 * Dipakai saat layar yang ditinggalkan tidak boleh dapat dikunjungi lagi lewat
 * tombol *Back* — mis. layar Tutup Shift setelah shift-nya benar-benar ditutup.
 */
export const posReplace = (screen: PosScreen, params?: Record<string, string>) =>
  usePosRouterStore.getState().replace(screen, params)

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
      if (!isPosScreen(next)) return

      // ── BUTIR 17 — Back tidak dapat menembus sesi yang sudah berakhir ────
      //
      // `replace` pada saga tutup shift sudah membuang entri layar Tutup Shift,
      // tetapi riwayat di belakangnya masih memuat Kasir Utama, Riwayat, dan
      // seterusnya. Tanpa penjagaan ini, satu ketukan *Back* tambahan membawa
      // siapa pun yang memegang perangkat kembali ke layar kasir milik shift
      // yang sudah ditutup.
      //
      // Diperiksa terhadap SESI, bukan terhadap kedalaman riwayat: yang
      // menentukan boleh-tidaknya sebuah layar dibuka adalah ada-tidaknya kasir
      // yang bertanggung jawab atasnya.
      if (!PUBLIC_SCREENS.has(next) && !usePosAuthStore.getState().staffId) {
        usePosRouterStore.getState().replace('login')
        return
      }

      usePosRouterStore.setState({ screen: next })
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const historyMode = usePosRouterStore((s) => s.historyMode)

  React.useEffect(() => {
    if (window.location.hash.slice(1) === screen) return

    if (historyMode === 'replace') {
      window.history.replaceState(null, '', `#${screen}`)
      return
    }
    window.history.pushState(null, '', `#${screen}`)
  }, [screen, historyMode])
}

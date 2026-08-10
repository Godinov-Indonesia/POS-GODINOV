'use client'

import * as React from 'react'

import { useSessionStore } from '@/lib/auth/session-store'

/**
 * Penjaga hidrasi — docs/05 §1.2.3.
 *
 * Store yang di-`persist` menghasilkan ketidakcocokan server/klien pada render
 * pertama: server tidak punya `sessionStorage`, sehingga `accessToken` selalu
 * `null` di HTML dan berisi nilai di klien. Tanpa penjaga ini, React membuang
 * hasil render server dan komponen yang bergantung pada sesi berkedip.
 */
const subscribeHydration = (onChange: () => void) =>
  useSessionStore.persist.onFinishHydration(onChange)

const getHydrationSnapshot = () => useSessionStore.persist.hasHydrated()

/** Server tidak pernah terhidrasi — snapshot-nya selalu `false`. */
const getServerHydrationSnapshot = () => false

export function useHasHydrated(): boolean {
  // `useSyncExternalStore` daripada `useState` + `useEffect`: hidrasi dapat
  // selesai SEBELUM efek terpasang, dan menambalnya dengan setState di dalam
  // efek memicu render berantai. Ini persis kasus yang dirancang untuk hook ini.
  return React.useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot,
  )
}

export function HydrationGuard({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback: React.ReactNode
}) {
  return useHasHydrated() ? <>{children}</> : <>{fallback}</>
}

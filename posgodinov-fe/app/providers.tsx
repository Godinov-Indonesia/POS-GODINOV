'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

import { Toaster } from '@/components/ui/toaster'
import { registerDateHeaderObserver } from '@/lib/api/http'
import { installAccessTokenResolver, scheduleProactiveRefresh } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'
import { queryClient } from '@/lib/query/query-client'
import { detectClockSkew } from '@/lib/time'

/**
 * Bootstrap sisi klien.
 *
 * Dua pendaftaran di bawah adalah pasangan dari inversi dependensi di
 * `lib/api/http.ts`: transport tidak mengimpor `lib/auth` maupun `lib/time`
 * (itu akan melingkar), jadi keduanya disuntikkan di sini — sekali, saat start.
 */
installAccessTokenResolver()
registerDateHeaderObserver(detectClockSkew)

export function RootProviders({ children }: { children: React.ReactNode }) {
  // Menjadwalkan ulang timer refresh setelah reload tab: timer hidup di memori,
  // sedangkan `accessTokenExpiry` bertahan di sessionStorage ([05 §1.4.3]).
  React.useEffect(() => {
    const expiry = useSessionStore.getState().accessTokenExpiry
    if (expiry !== null) scheduleProactiveRefresh(expiry)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

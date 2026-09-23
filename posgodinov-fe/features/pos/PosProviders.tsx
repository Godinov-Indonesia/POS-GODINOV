'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

import { Toaster } from '@/components/ui/toaster'
import { queryClient } from '@/lib/query/query-client'
import { installDeviceTokenResolver } from '@/lib/auth/device-session'
import { registerDateHeaderObserver } from '@/lib/api/http'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import { detectClockSkew, subscribeClockSkew } from '@/lib/time'
import { setMeta } from '@/lib/db/repositories/meta.repo'

/**
 * Bootstrap POS.
 *
 * Berbeda dari `RootProviders` Admin, di sini yang didaftarkan adalah **device
 * token**, bukan access token — dan Dexie hanya tersentuh dari cabang ini,
 * sehingga bundle Admin tetap bebas darinya ([05 §1.1.4]).
 */
installDeviceTokenResolver()
registerDateHeaderObserver(detectClockSkew)

// Skew disimpan ke Dexie dan dipantulkan ke store agar StatusBar dapat
// menampilkannya. ⚠️ Jangan mengoreksi `client_created_at` secara otomatis —
// itu membuat data lokal tidak konsisten dengan struk yang sudah tercetak.
subscribeClockSkew((skewMs, significant) => {
  useSyncStore.getState().setClockSkew(skewMs, significant)
  void setMeta('clock.lastSkewMs', skewMs)
})

/**
 * TanStack Query di POS dipakai **hanya** untuk operasi jaringan: `bindDevice`,
 * `fetchMasterData`, `syncUp`, dan tab "Sebelumnya" di P-09 ([05 §1.2.4]).
 * Layar kasir sendiri membaca dari Dexie lewat `useLiveQuery`.
 */
export function PosProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

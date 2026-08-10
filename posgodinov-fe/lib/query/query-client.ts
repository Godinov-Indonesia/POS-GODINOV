import { QueryClient } from '@tanstack/react-query'

import { PosApiError } from '@/lib/api/errors'

/**
 * Konfigurasi TanStack Query — docs/05 §1.2.2.
 *
 * Disetel mengikuti karakter backend: tanpa paginasi, tanpa cache header.
 * Tanggung jawabnya hanya `/v1/business/*`. Layar kasir **tidak pernah**
 * membaca dari sini — ia membaca dari `useLiveQuery` (Dexie, ADR-03).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // Data master jarang berubah
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false, // Laporan tanpa paginasi = payload berat
      retry: (failureCount, error) => {
        // 400 dari backend adalah kegagalan bisnis yang deterministik —
        // mengulang tidak berguna dan hanya memperlambat umpan balik.
        if (error instanceof PosApiError && error.statusCode < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

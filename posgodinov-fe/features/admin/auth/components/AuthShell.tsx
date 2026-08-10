'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { useHasHydrated } from '@/components/hydration-guard'
import { Skeleton } from '@/components/ui/feedback'
import { useSessionStore } from '@/lib/auth/session-store'

/**
 * Shell halaman publik.
 *
 * Pengalihan dilakukan **setelah** hidrasi selesai. Membacanya lebih awal
 * berarti membaca `null` dari render server dan mengalihkan pengguna yang
 * sebenarnya sudah masuk kembali ke halaman login ([05 §1.2.3]).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHasHydrated()
  const status = useSessionStore((s) => s.status)

  React.useEffect(() => {
    if (hydrated && status === 'authenticated') router.replace('/admin')
  }, [hydrated, status, router])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <p className="text-pos-xl font-bold tracking-tight text-brand">POS Godinov</p>
          <p className="mt-1 text-pos-sm text-fg-muted">Panel pemilik bisnis</p>
        </header>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          {hydrated ? children : <Skeleton className="h-64 w-full" />}
        </div>
      </div>
    </main>
  )
}

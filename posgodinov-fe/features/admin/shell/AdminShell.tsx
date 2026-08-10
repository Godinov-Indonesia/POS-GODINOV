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

  React.useEffect(() => {
    if (hydrated && status !== 'authenticated' && status !== 'refreshing') {
      router.replace('/login')
    }
  }, [hydrated, status, router])

  if (!hydrated || status === 'unauthenticated') {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

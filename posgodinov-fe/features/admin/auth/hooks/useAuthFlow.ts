'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { loginBusiness, registerBusiness } from '@/lib/api/endpoints/auth'
import { listOutlets } from '@/lib/api/endpoints/outlets'
import { scheduleProactiveRefresh } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'
import { queryClient } from '@/lib/query/query-client'
import { queryKeys } from '@/lib/query/keys'
import type { AuthResponse, LoginRequest, Outlet, RegisterRequest } from '@/lib/types/api'

/**
 * Alur pasca-autentikasi — docs/05 §1.4.4.
 *
 * Setelah token tersimpan, tujuan navigasi ditentukan oleh jumlah outlet:
 * - 0 outlet  → `/admin/outlets/new` (wajib buat outlet dulu; seluruh modul
 *               lain ber-scope outlet dan akan kosong tanpa ini)
 * - 1 outlet  → pilih otomatis, lanjut ke `/admin`
 * - >1 outlet → tampilkan pemilih outlet
 */
export type PostAuthDestination =
  | { kind: 'needs-outlet' }
  | { kind: 'ready' }
  | { kind: 'choose-outlet'; outlets: Outlet[] }

function persistSession(payload: AuthResponse): void {
  useSessionStore.getState().setSession(payload)
  // Backend tidak mengirim masa berlaku; `setSession` menghitungnya dari jam
  // klien (ADR-04). Timer dijadwalkan dari nilai yang baru saja ditulis.
  const expiry = useSessionStore.getState().accessTokenExpiry
  if (expiry !== null) scheduleProactiveRefresh(expiry)
}

async function resolveDestination(): Promise<PostAuthDestination> {
  const outlets = await queryClient.fetchQuery({
    queryKey: queryKeys.outlets(),
    queryFn: listOutlets,
  })

  if (outlets.length === 0) return { kind: 'needs-outlet' }

  if (outlets.length === 1) {
    useSessionStore.getState().setActiveOutlet(outlets[0].id)
    return { kind: 'ready' }
  }

  return { kind: 'choose-outlet', outlets }
}

export function useAuthFlow() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [outletChoices, setOutletChoices] = React.useState<Outlet[] | null>(null)

  const finish = React.useCallback(
    async (payload: AuthResponse) => {
      persistSession(payload)
      const destination = await resolveDestination()

      if (destination.kind === 'needs-outlet') {
        router.replace('/admin/outlets/new')
        return
      }
      if (destination.kind === 'ready') {
        router.replace('/admin')
        return
      }
      setOutletChoices(destination.outlets)
    },
    [router],
  )

  const login = React.useCallback(
    async (body: LoginRequest) => {
      setPending(true)
      try {
        await finish(await loginBusiness(body))
      } finally {
        setPending(false)
      }
    },
    [finish],
  )

  const register = React.useCallback(
    async (body: RegisterRequest) => {
      setPending(true)
      try {
        await finish(await registerBusiness(body))
      } finally {
        setPending(false)
      }
    },
    [finish],
  )

  const chooseOutlet = React.useCallback(
    (outletId: string) => {
      useSessionStore.getState().setActiveOutlet(outletId)
      router.replace('/admin')
    },
    [router],
  )

  return { login, register, pending, outletChoices, chooseOutlet }
}

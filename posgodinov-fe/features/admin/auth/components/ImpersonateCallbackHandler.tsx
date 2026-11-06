'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

import { scheduleProactiveRefresh } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'
import { listOutlets } from '@/lib/api/endpoints/outlets'
import { BASE_URL } from '@/lib/api/http'
import { queryClient } from '@/lib/query/query-client'
import { queryKeys } from '@/lib/query/keys'
import type { AuthResponse, Business } from '@/lib/types/api'

/**
 * Quarantine handler untuk Impersonasi Merchant dari Landlord Portal.
 *
 * Landlord mengarahkan ke /impersonate?token=...&refresh_token=...&business=JSON
 * Komponen ini:
 * 1. Membaca token & data bisnis dari query params
 * 2. Menyimpan sesi ke session store
 * 3. Menentukan outlet dan mengarahkan ke dashboard (/admin)
 *
 * Halaman ini sengaja blank — tanpa UI — sesuai instruksi.
 */
export function ImpersonateCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token') || token
    const businessRaw = searchParams.get('business')

    if (!token) {
      setError('Token impersonasi tidak ditemukan.')
      return
    }

    let isMounted = true

    const loginAndRedirect = async () => {
      let business: Business | null = null

      if (businessRaw) {
        try {
          business = JSON.parse(decodeURIComponent(businessRaw))
        } catch {
          // Fallback fetch profil bisnis
        }
      }

      if (!business) {
        try {
          const res = await fetch(`${BASE_URL}/v1/auth/business/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (res.ok) {
            const body = await res.json()
            business = body.data || body
          }
        } catch {
          // Request error
        }
      }

      if (!business) {
        if (isMounted) setError('Data bisnis impersonasi tidak dapat dimuat.')
        return
      }

      const payload: AuthResponse = {
        business,
        access_token: token,
        refresh_token: refreshToken || token,
      }

      // Simpan sesi
      useSessionStore.getState().setSession(payload)
      // Masa berlaku impersonasi 30 menit
      const impersonateExpiry = Date.now() + 30 * 60 * 1000
      useSessionStore.getState().setAccessToken(token, impersonateExpiry)
      scheduleProactiveRefresh(impersonateExpiry)

      // Arahkan ke dashboard
      try {
        const outlets = await queryClient.fetchQuery({
          queryKey: queryKeys.outlets(),
          queryFn: listOutlets,
        })
        if (outlets.length === 0) {
          router.replace('/admin/outlets/new')
        } else if (outlets.length === 1) {
          useSessionStore.getState().setActiveOutlet(outlets[0].id)
          router.replace('/admin')
        } else {
          router.replace('/admin')
        }
      } catch {
        router.replace('/admin')
      }
    }

    loginAndRedirect()

    return () => {
      isMounted = false
    }
  }, [router, searchParams])

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-pos-base font-semibold text-fg">Login Impersonasi Gagal</p>
          <p className="text-pos-sm text-fg-muted">{error}</p>
          <a href="/login" className="text-pos-sm font-medium text-accent underline">
            Kembali ke halaman login
          </a>
        </div>
      </main>
    )
  }

  // Blank quarantine page
  return null
}

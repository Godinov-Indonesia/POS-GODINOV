'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

import { scheduleProactiveRefresh } from '@/lib/auth/session-manager'
import { useSessionStore } from '@/lib/auth/session-store'
import { listOutlets } from '@/lib/api/endpoints/outlets'
import { queryClient } from '@/lib/query/query-client'
import { queryKeys } from '@/lib/query/keys'
import type { AuthResponse } from '@/lib/types/api'

/**
 * Quarantine handler OAuth Google.
 *
 * BE mengarahkan ke /oauth/callback?access_token=...&refresh_token=...&business=JSON
 * setelah pertukaran token Google berhasil. Komponen ini:
 * 1. Membaca params dari URL
 * 2. Menyimpan sesi ke session store
 * 3. Menentukan outlet dan mengarahkan ke dashboard
 *
 * Halaman ini sengaja blank — tidak ada UI — karena operasinya berlangsung sangat cepat.
 */
export function OAuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const businessRaw = searchParams.get('business')

    if (!accessToken || !refreshToken || !businessRaw) {
      setError('Parameter OAuth tidak lengkap.')
      return
    }

    let business: AuthResponse['business']
    try {
      business = JSON.parse(decodeURIComponent(businessRaw))
    } catch {
      setError('Data bisnis tidak valid.')
      return
    }

    const payload: AuthResponse = {
      business,
      access_token: accessToken,
      refresh_token: refreshToken,
    }

    // Simpan sesi
    useSessionStore.getState().setSession(payload)
    const expiry = useSessionStore.getState().accessTokenExpiry
    if (expiry !== null) scheduleProactiveRefresh(expiry)

    // Tentukan tujuan navigasi berdasarkan jumlah outlet
    queryClient
      .fetchQuery({ queryKey: queryKeys.outlets(), queryFn: listOutlets })
      .then((outlets) => {
        if (outlets.length === 0) {
          router.replace('/admin/outlets/new')
        } else if (outlets.length === 1) {
          useSessionStore.getState().setActiveOutlet(outlets[0].id)
          router.replace('/admin')
        } else {
          // Multiple outlets — arahkan ke admin, OutletSwitcher akan tampil
          router.replace('/admin')
        }
      })
      .catch(() => {
        // Gagal ambil outlet → arahkan ke admin, OutletGuard menangani
        router.replace('/admin')
      })
  }, [router, searchParams])

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-pos-base font-semibold text-fg">Login Google Gagal</p>
          <p className="text-pos-sm text-fg-muted">{error}</p>
          <a href="/login" className="text-pos-sm font-medium text-accent underline">
            Kembali ke halaman login
          </a>
        </div>
      </main>
    )
  }

  // Blank quarantine — tidak ada UI, hanya proses token
  return null
}

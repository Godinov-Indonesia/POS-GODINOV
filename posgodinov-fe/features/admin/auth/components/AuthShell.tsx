'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Logo } from '@/components/brand/Logo'
import { useHasHydrated } from '@/components/hydration-guard'
import { Skeleton } from '@/components/ui/feedback'
import { useSessionStore } from '@/lib/auth/session-store'

export function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHasHydrated()
  const status = useSessionStore((s) => s.status)

  React.useEffect(() => {
    if (hydrated && status === 'authenticated') router.replace('/admin')
  }, [hydrated, status, router])

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-surface">
      {/* Panel kiri: logo pinned di atas, form di-center di sisa ruang. */}
      <div className="flex w-full flex-col overflow-y-auto lg:w-1/2">
        <div className="shrink-0 px-6 pt-8 sm:px-10 lg:px-16 xl:px-22">
          <Logo priority className="h-15" />
        </div>

        <div className="flex flex-1 items-center px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-md">
            {hydrated ? children : <Skeleton className="h-64 w-full" />}
          </div>
        </div>
      </div>

      {/* Panel kanan: kartu navy dengan sisi kiri melengkung. Copy dan
          ilustrasi disusun vertikal dalam satu kolom dengan padding yang
          sama, sehingga ilustrasi rata-tengah selaras dengan judul/subjudul
          di atasnya — bukan dua elemen posisi independen. */}
      <div
        className="relative hidden flex-col overflow-hidden rounded-l-[3rem] bg-surface-inverse px-16 pt-16 pb-10 lg:flex lg:w-1/2 xl:px-24"
      >
        {/* Glow dekoratif — diklip oleh rounded corner panel ini. */}
        <div
          className="pointer-events-none absolute -top-24 right-[-6rem] size-80 rounded-full bg-accent/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-[15%] size-72 rounded-full bg-accent/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 shrink-0">
          <p className="max-w-sm text-pos-xl font-semibold leading-snug text-fg-inverse">
            Kelola kasir, stok, dan laporan dalam satu aplikasi.
          </p>
          <p className="mt-3 max-w-sm text-pos-sm text-fg-inverse/70">
            Godinov POS membantu bisnis Anda berjalan rapi dari outlet pertama hingga yang
            ke-sepuluh.
          </p>
        </div>

        {/* Ilustrasi — rata-tengah horizontal terhadap kolom yang sama
            dengan teks di atasnya, mengisi sisa ruang vertikal panel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/ilustrasi.png"
          alt=""
          aria-hidden="true"
          className="relative z-20 mx-auto mt-6 h-full right-5 max-h-[36rem] w-auto max-w-full object-contain"
        />
      </div>
    </main>
  )
}

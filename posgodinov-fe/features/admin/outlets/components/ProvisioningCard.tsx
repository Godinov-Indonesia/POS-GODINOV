'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Check,
  ClipboardCheck,
  Copy,
  Download,
  Info,
  MonitorSmartphone,
  ShieldAlert,
} from 'lucide-react'
import * as React from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { BASE_URL } from '@/lib/api/http'
import { useSessionStore } from '@/lib/auth/session-store'
import { cn } from '@/lib/utils/cn'

type PublicLandingData = {
  settings?: {
    apk_pos_url?: string
    apk_so_url?: string
  }
}

async function fetchPublicLanding(): Promise<PublicLandingData> {
  const res = await fetch(`${BASE_URL}/v1/public/landing-page`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Gagal memuat data')
  const json = await res.json()
  return (json.data ?? json) as PublicLandingData
}

/**
 * D-06 Info Provisioning Perangkat — docs/04 §B.1 & §B.2.
 *
 * `serial_business` dan `serial_tenant` **wajib** ditampilkan di sini: teknisi
 * membutuhkan keduanya untuk device binding, dan tidak ada endpoint lain yang
 * menyediakannya. `serial_business` hanya dikembalikan saat register/login,
 * sehingga nilainya diambil dari `sessionStore`, bukan dari request baru.
 *
 * Dilengkapi dengan langkah unduh aplikasi APK POS/SO agar teknisi/pemilik
 * dapat mengunduh langsung di halaman pemasangan outlet.
 */
export function ProvisioningCard({ outletId }: { outletId: string }) {
  const { data: outlets, isPending } = useOutlets()
  const business = useSessionStore((s) => s.business)
  const outlet = outlets?.find((o) => o.id === outletId)

  const { data: landingData, isLoading: isApkLoading } = useQuery({
    queryKey: ['public-landing-apk'],
    queryFn: fetchPublicLanding,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const posUrl = landingData?.settings?.apk_pos_url ?? ''
  const soUrl = landingData?.settings?.apk_so_url ?? ''

  if (isPending) return <Skeleton className="h-64 w-full max-w-2xl" />

  if (!outlet) {
    return (
      <Banner tone="danger">
        Outlet <span className="font-mono">{outletId}</span> tidak ditemukan pada bisnis ini.
      </Banner>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Info Pemasangan Perangkat"
        description={`Panduan dan kredensial untuk menghubungkan perangkat kasir ke outlet ${outlet.name}.`}
      />

      {/* Langkah 1: Unduh Aplikasi Android */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-pos-xs font-bold text-fg-inverse">
              1
            </span>
            <CardTitle>Unduh Aplikasi Android</CardTitle>
          </div>
          <CardDescription>
            Download dan instal aplikasi POS Godinov di perangkat Android kasir atau tim inventaris outlet ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* App Kasir (POS) */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-bg-muted p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                    <MonitorSmartphone className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-pos-sm font-semibold text-fg">App Kasir (POS)</h3>
                    <p className="text-pos-xs text-fg-muted">Petugas kasir &amp; meja transaksi</p>
                  </div>
                </div>
                <p className="text-pos-xs text-fg-subtle">
                  Transaksi penjualan, cetak struk, dan rekonsiliasi shift kasir.
                </p>
              </div>

              <div className="mt-4">
                {isApkLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : posUrl ? (
                  <a
                    href={posUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'primary', size: 'sm', block: true }),
                      'gap-2',
                    )}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Unduh APK Kasir
                  </a>
                ) : (
                  <span className="inline-block text-pos-xs italic text-fg-subtle">
                    Link download belum dikonfigurasi.
                  </span>
                )}
              </div>
            </div>

            {/* App Stock Opname (SO) */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-bg-muted p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-success-subtle text-success-text">
                    <ClipboardCheck className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-pos-sm font-semibold text-fg">App Stock Opname (SO)</h3>
                    <p className="text-pos-xs text-fg-muted">Staff gudang &amp; inventaris</p>
                  </div>
                </div>
                <p className="text-pos-xs text-fg-subtle">
                  Penghitungan stok fisik (blind opname) dan kontrol inventaris outlet.
                </p>
              </div>

              <div className="mt-4">
                {isApkLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : soUrl ? (
                  <a
                    href={soUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'neutral', size: 'sm', block: true }),
                      'gap-2',
                    )}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Unduh APK Stock Opname
                  </a>
                ) : (
                  <span className="inline-block text-pos-xs italic text-fg-subtle">
                    Link download belum dikonfigurasi.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-pos-xs text-fg-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <p>
              <strong>Petunjuk Instalasi:</strong> Format aplikasi berupa file APK. Pastikan mengaktifkan izin{' '}
              <em>&quot;Instal aplikasi dari sumber tidak dikenal&quot;</em> pada pengaturan keamanan Android perangkat sebelum instalasi.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Langkah 2: Kredensial Binding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-pos-xs font-bold text-fg-inverse">
              2
            </span>
            <CardTitle>Kredensial Binding Perangkat</CardTitle>
          </div>
          <CardDescription>
            Buka aplikasi di perangkat kasir, pilih Hubungkan Perangkat, lalu masukkan data berikut untuk mengikat perangkat ke outlet {outlet.name}:
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CopyRow label="Serial Business" value={business?.serial_business ?? '—'} />
          <CopyRow label="Serial Outlet (serial_tenant)" value={outlet.serial_tenant || outlet.serial_outlet || '—'} />
          <CopyRow label="ID Outlet" value={outlet.id} />
        </CardContent>
      </Card>

      {/* Langkah 3: Login Kasir */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-pos-xs font-bold text-fg-inverse">
              3
            </span>
            <CardTitle>Login Staff Kasir</CardTitle>
          </div>
          <CardDescription>
            Setelah perangkat terhubung, kasir dapat langsung login menggunakan PIN staff kasir yang telah didaftarkan di menu Staff outlet ini.
          </CardDescription>
        </CardHeader>
      </Card>

      <Banner tone="warning" icon={ShieldAlert} title="Keamanan Perangkat Outlet">
        Proses penghubungan perangkat kasir memerlukan autentikasi pemilik bisnis.
        Pastikan hanya menghubungkan perangkat resmi yang berada di bawah pengawasan Anda.
      </Banner>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API butuh secure context; kegagalan di sini tidak fatal —
      // nilainya tetap terlihat dan dapat disalin manual.
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-muted p-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-pos-xs text-fg-muted">{label}</span>
        <span className="truncate font-mono text-pos-md font-semibold text-fg">{value}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto"
        onClick={copy}
        aria-label={`Salin ${label}`}
      >
        {copied ? (
          <Check className="size-5 text-success-text" aria-hidden="true" />
        ) : (
          <Copy className="size-5" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}


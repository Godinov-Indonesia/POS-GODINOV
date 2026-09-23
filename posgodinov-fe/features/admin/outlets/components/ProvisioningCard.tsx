'use client'

import { Check, Copy, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { useSessionStore } from '@/lib/auth/session-store'

/**
 * D-06 Info Provisioning Perangkat — docs/04 §B.1 & §B.2.
 *
 * `serial_business` dan `serial_tenant` **wajib** ditampilkan di sini: teknisi
 * membutuhkan keduanya untuk device binding, dan tidak ada endpoint lain yang
 * menyediakannya. `serial_business` hanya dikembalikan saat register/login,
 * sehingga nilainya diambil dari `sessionStore`, bukan dari request baru.
 */
export function ProvisioningCard({ outletId }: { outletId: string }) {
  const { data: outlets, isPending } = useOutlets()
  const business = useSessionStore((s) => s.business)
  const outlet = outlets?.find((o) => o.id === outletId)

  if (isPending) return <Skeleton className="h-64 w-full max-w-2xl" />

  if (!outlet) {
    return (
      <Banner tone="danger">
        Outlet <span className="font-mono">{outletId}</span> tidak ditemukan pada bisnis ini.
      </Banner>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Info Pemasangan Perangkat"
        description={`Data yang dibutuhkan teknisi untuk mengikat perangkat kasir ke outlet ${outlet.name}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Kredensial binding</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CopyRow label="Serial Business" value={business?.serial_business ?? '—'} />
          <CopyRow label="Serial Outlet (serial_tenant)" value={outlet.serial_tenant} />
          <CopyRow label="ID Outlet" value={outlet.id} />
        </CardContent>
      </Card>

      <Banner tone="warning" icon={ShieldAlert} title="Perangkat terikat permanen">
        Proses binding meminta <strong>password pemilik bisnis</strong> dan menerbitkan token
        perangkat berumur sekitar 10 tahun. Backend belum menyediakan endpoint pencabutan, sehingga
        perangkat yang hilang atau dicuri mempertahankan akses sinkronisasi. Lakukan binding hanya
        pada perangkat yang Anda kendalikan.
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

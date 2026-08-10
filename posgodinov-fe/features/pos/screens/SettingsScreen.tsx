'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Download,
  History,
  LogOut,
  Pause,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Num } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { PosScreen } from '@/features/pos/router/screens'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import { getBoundAt, getBoundOutletLabel } from '@/lib/auth/device-session'
import { countHeldCarts } from '@/lib/db/repositories/held-cart.repo'
import { countProducts } from '@/lib/db/repositories/master.repo'
import { formatDateTimeId, formatSkewMinutes } from '@/lib/time'
import { getLastMasterSyncAt, syncMasterData } from '@/lib/sync/master-sync'

/** P-14 Pengaturan — docs/04 §A.1. Pintu masuk ke seluruh layar sekunder POS. */
export function SettingsScreen() {
  const staffName = usePosAuthStore((s) => s.staffName)
  const logout = usePosAuthStore((s) => s.logout)
  const clockSkewMs = useSyncStore((s) => s.clockSkewMs)
  const clockWarning = useSyncStore((s) => s.clockWarning)
  const [resyncing, setResyncing] = React.useState(false)

  const info = useLiveQuery(
    async () => ({
      outletLabel: await getBoundOutletLabel(),
      boundAt: await getBoundAt(),
      lastMasterSyncAt: await getLastMasterSyncAt(),
      products: await countProducts(),
      heldCarts: await countHeldCarts(),
    }),
    [],
    undefined,
  )

  const resync = async () => {
    setResyncing(true)
    try {
      const result = await syncMasterData()
      toast.success(`Master data diperbarui — ${result.products} produk`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sinkronisasi master gagal')
    } finally {
      setResyncing(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Pengaturan</h1>
      </div>

      {clockWarning && clockSkewMs !== null ? (
        <Banner tone="warning" icon={AlertTriangle} title="Jam perangkat melenceng">
          Selisih sekitar <Num>{formatSkewMinutes(clockSkewMs)}</Num> menit dari server. Waktu
          transaksi dan laporan akan tidak akurat. Perbaiki jam perangkat —{' '}
          <strong>jangan</strong> mengandalkan koreksi otomatis, karena itu akan membuat data lokal
          tidak konsisten dengan struk yang sudah tercetak.
        </Banner>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-pos-base font-semibold text-fg">Perangkat</h2>
          <dl className="flex flex-col gap-1 text-pos-sm">
            <Row label="Outlet">{info?.outletLabel ?? '—'}</Row>
            <Row label="Dipasang">
              {info?.boundAt ? formatDateTimeId(info.boundAt) : '—'}
            </Row>
            <Row label="Master data terakhir">
              {info?.lastMasterSyncAt ? formatDateTimeId(info.lastMasterSyncAt) : 'Belum pernah'}
            </Row>
            <Row label="Produk tersimpan">
              <Num>{info?.products ?? 0}</Num>
            </Row>
            <Row label="Kasir aktif">{staffName ?? '—'}</Row>
          </dl>

          <Button variant="neutral" size="lg" onClick={resync} disabled={resyncing}>
            <Download className="size-5" aria-hidden="true" />
            {resyncing ? 'Mengunduh…' : 'Sinkronkan Master Data'}
          </Button>

          <p className="text-pos-xs text-fg-muted">
            Setiap sinkronisasi menarik seluruh katalog — backend tidak menyediakan sinkronisasi
            inkremental. Jalankan hanya bila ada perubahan produk di Dashboard.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-pos-base font-semibold text-fg">Menu Kasir</h2>
          <NavItem screen="history" icon={History} label="Riwayat Transaksi" />
          <NavItem
            screen="held-carts"
            icon={Pause}
            label="Pesanan Ditahan"
            badge={info?.heldCarts}
          />
          <NavItem screen="void" icon={Trash2} label="Batalkan Transaksi" />
          <NavItem screen="product-waste" icon={ClipboardList} label="Lapor Waste Produk" />
          <NavItem screen="sync-status" icon={Download} label="Status Sinkronisasi" />
          <NavItem screen="close-shift" icon={Wallet} label="Tutup Shift" />

          <Button
            variant="neutral"
            size="lg"
            className="mt-2"
            onClick={() => {
              logout()
              posNavigate('login')
            }}
          >
            <LogOut className="size-5" aria-hidden="true" />
            Ganti Kasir
          </Button>

          <p className="text-pos-xs text-fg-muted">
            Mengganti kasir <strong>tidak</strong> menutup shift. Laci tetap terbuka dan
            perhitungan selisih kas berjalan sampai shift ditutup.
          </p>
        </section>
      </div>
    </div>
  )
}

function NavItem({
  screen,
  icon: Icon,
  label,
  badge,
}: {
  screen: PosScreen
  icon: LucideIcon
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={() => posNavigate(screen)}
      className="flex min-h-touch items-center gap-3 rounded-lg border border-border px-3 text-left hover:bg-bg-muted"
    >
      <Icon className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
      <span className="text-pos-base text-fg">{label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-accent px-2 text-fg-inverse">
          <Num className="text-pos-xs font-semibold">{badge}</Num>
        </span>
      ) : null}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  )
}

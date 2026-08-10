'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import { runManualSync } from '@/features/pos/sync/useSyncEngine'
import { useOnlineStatus } from '@/features/pos/components/StatusBar'
import type { LocalTransaction } from '@/lib/db/models'
import { countUnsyncedShifts } from '@/lib/db/repositories/shift.repo'
import {
  countUnsyncedTransactions,
  countUnsyncedWastes,
  listFailedTransactions,
} from '@/lib/db/repositories/transaction.repo'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-13 Status Sinkronisasi — docs/05 §1.6.6.
 *
 * Menyatakan dua batasan secara eksplisit kepada operator:
 * 1. Sinkronisasi **hanya berjalan saat aplikasi terbuka** (ADR-06).
 * 2. Kegagalan shift tidak dilaporkan per-ID, sehingga peringatannya agregat.
 */
export function SyncStatusScreen() {
  const online = useOnlineStatus()
  const syncing = useSyncStore((s) => s.syncing)
  const lastError = useSyncStore((s) => s.lastError)
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt)
  const lastSkipped = useSyncStore((s) => s.lastSkipped)

  const counts = useLiveQuery(
    async () => ({
      transactions: await countUnsyncedTransactions(),
      shifts: await countUnsyncedShifts(),
      wastes: await countUnsyncedWastes(),
    }),
    [],
    { transactions: 0, shifts: 0, wastes: 0 },
  )

  const failed = useLiveQuery(() => listFailedTransactions(), [], [] as LocalTransaction[])
  const queued = counts.transactions + counts.shifts + counts.wastes

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Status Sinkronisasi</h1>
      </div>

      <Banner tone="warning" title="Sinkronisasi hanya berjalan saat aplikasi terbuka">
        Biarkan aplikasi ini terbuka sampai antrean kosong. Menutup tab menghentikan pengiriman —
        data tetap aman di perangkat, tetapi belum sampai ke server.
      </Banner>

      <div className="grid gap-2 sm:grid-cols-3">
        <CountCard label="Transaksi" value={counts.transactions} />
        <CountCard label="Shift" value={counts.shifts} />
        <CountCard label="Waste" value={counts.wastes} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="xl"
          onClick={() => void runManualSync()}
          disabled={syncing || !online}
        >
          <RefreshCw className={syncing ? 'size-5 animate-spin' : 'size-5'} aria-hidden="true" />
          {syncing ? 'MENYINKRONKAN…' : 'SINKRONKAN SEKARANG'}
        </Button>

        {!online ? (
          <Badge tone="neutral">Perangkat offline — akan otomatis dicoba saat online</Badge>
        ) : null}
      </div>

      <dl className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-pos-sm">
        <Row label="Terakhir berhasil">
          {lastSuccessAt ? formatDateTimeId(lastSuccessAt) : 'Belum pernah'}
        </Row>
        {lastSkipped ? <Row label="Dilewati">{SKIP_LABEL[lastSkipped]}</Row> : null}
        {lastError ? (
          <Row label="Galat terakhir">
            <span className="text-danger">{lastError}</span>
          </Row>
        ) : null}
      </dl>

      {counts.shifts > 0 && queued > 0 ? (
        <Banner tone="warning" icon={AlertTriangle} title="Shift belum tersimpan di server">
          Backend tidak melaporkan shift mana yang gagal, hanya jumlahnya. Selama shift induknya
          belum pasti tersimpan, transaksi pada shift itu <strong>sengaja tidak</strong> ditandai
          tersinkron — menandainya lebih awal adalah cara termudah kehilangan data penjualan.
        </Banner>
      ) : null}

      <h2 className="mt-2 text-pos-base font-semibold text-fg">Transaksi bermasalah</h2>
      {failed.length === 0 ? (
        <EmptyState title="Tidak ada transaksi yang gagal" />
      ) : (
        <ul className="flex flex-col gap-2">
          {failed.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-subtle p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Num className="font-semibold">{shortId(transaction.id)}</Num>
                <span className="text-pos-xs text-fg-muted">
                  {formatDateTimeId(transaction.client_created_at)} ·{' '}
                  <Num>{transaction._syncAttempts}</Num> percobaan
                </span>
                {transaction._syncError ? (
                  <span className="text-pos-xs text-danger">{transaction._syncError}</span>
                ) : null}
              </div>
              <Money minor={transaction.total_amount} size="md" />
            </li>
          ))}
        </ul>
      )}

      <p className="text-pos-xs text-fg-muted">
        Baris yang berulang kali gagal tidak pernah dibuang. Mesin akan terus mencoba dengan jeda
        yang membesar hingga maksimal 5 menit.
      </p>
    </div>
  )
}

const SKIP_LABEL = {
  locked: 'Tab lain sedang menyinkronkan',
  backoff: 'Menunggu jeda setelah kegagalan',
  offline: 'Perangkat offline',
  empty: 'Tidak ada yang perlu dikirim',
} as const

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
      <span className="text-pos-sm text-fg-muted">{label}</span>
      <Num className="text-pos-xl font-semibold">{value}</Num>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

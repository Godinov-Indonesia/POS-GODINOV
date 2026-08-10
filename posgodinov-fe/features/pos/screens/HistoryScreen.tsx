'use client'

import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban, Check, Receipt } from 'lucide-react'
import * as React from 'react'

import { Badge, SyncBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { fetchServerTransactions } from '@/lib/api/endpoints/pos-sync'
import { POS_SERVER_HISTORY_LIMIT } from '@/lib/constants/limits'
import type { LocalTransaction } from '@/lib/db/models'
import { listTransactionsToday } from '@/lib/db/repositories/transaction.repo'
import { toMinor } from '@/lib/money'
import { formatDateTimeId } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

/**
 * P-09 Riwayat Transaksi — docs/04 §A.1.
 *
 * Dua tab dengan sumber data berbeda:
 * - **Hari Ini** → Dexie. Selalu tersedia, termasuk yang belum tersinkron.
 * - **Sebelumnya** → server, dan **hanya 50 transaksi terbaru selamanya**
 *   karena paginasi di-hard-code di backend ([03 §2.4]).
 */
export function HistoryScreen() {
  const [tab, setTab] = React.useState<'today' | 'server'>('today')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Riwayat Transaksi</h1>
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === 'today'} onClick={() => setTab('today')}>
          Hari Ini
        </TabButton>
        <TabButton active={tab === 'server'} onClick={() => setTab('server')}>
          Sebelumnya
        </TabButton>
      </div>

      {tab === 'today' ? <TodayTab /> : <ServerTab />}
    </div>
  )
}

function TodayTab() {
  const transactions = useLiveQuery(
    () => listTransactionsToday(),
    [],
    [] as LocalTransaction[],
  )

  if (!transactions.length) {
    return <EmptyState icon={Receipt} title="Belum ada transaksi hari ini" />
  }

  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((transaction) => (
        <li
          key={transaction.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <Num className="font-semibold">{shortId(transaction.id)}</Num>
              {transaction.status === 'CANCELLED' ? (
                <Badge tone="danger" icon={Ban}>
                  Dibatalkan
                </Badge>
              ) : (
                <Badge tone="success" icon={Check}>
                  Selesai
                </Badge>
              )}
              <SyncBadge state={transaction._synced === 1 ? 'synced' : 'pending'} />
            </span>
            <span className="text-pos-xs text-fg-muted">
              {formatDateTimeId(transaction.client_created_at)} ·{' '}
              <Num>{transaction.items.length}</Num> item
            </span>
          </div>

          <Money
            minor={transaction.total_amount}
            size="lg"
            tone={transaction.status === 'CANCELLED' ? 'muted' : 'default'}
          />

          <Button
            variant="neutral"
            onClick={() => posNavigate('receipt', { transactionId: transaction.id })}
          >
            Struk
          </Button>
        </li>
      ))}
    </ul>
  )
}

function ServerTab() {
  const { data, isPending, error } = useQuery({
    queryKey: ['pos', 'server-transactions'],
    queryFn: fetchServerTransactions,
  })

  if (isPending) return <SkeletonTable />

  if (error) {
    return (
      <Banner tone="danger">
        Gagal memuat riwayat server. Tab ini memerlukan jaringan; riwayat hari ini tetap tersedia
        offline.
      </Banner>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Banner tone="info">
        Menampilkan <Num>{POS_SERVER_HISTORY_LIMIT}</Num> transaksi terakhir dari server. Backend
        belum menyediakan paginasi maupun filter tanggal untuk endpoint ini.
      </Banner>

      {!data?.length ? (
        <EmptyState icon={Receipt} title="Tidak ada riwayat di server" />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Num className="font-semibold">{shortId(transaction.id)}</Num>
                <span className="text-pos-xs text-fg-muted">
                  {formatDateTimeId(transaction.client_created_at)}
                </span>
              </div>
              <Money minor={toMinor(transaction.total_amount)} size="lg" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-touch rounded-md border px-4 text-pos-sm',
        active
          ? 'border-accent bg-accent-subtle font-semibold text-accent'
          : 'border-border bg-surface text-fg-muted',
      )}
    >
      {children}
    </button>
  )
}

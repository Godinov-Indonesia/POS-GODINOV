'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CloudOff, Menu, RefreshCw, ShieldAlert, Wifi } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Num } from '@/components/ui/money'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import {
  countUnsyncedTransactions,
  countUnsyncedWastes,
} from '@/lib/db/repositories/transaction.repo'
import { countUnsyncedShifts } from '@/lib/db/repositories/shift.repo'
import { formatSkewMinutes } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

/**
 * StatusBar POS — docs/06 §4.7.
 *
 * Menampilkan tiga hal yang harus selalu terlihat kasir: identitas outlet,
 * status jaringan, dan **hitungan antrean sinkronisasi**. Yang terakhir bukan
 * hiasan: sinkronisasi hanya berjalan saat aplikasi terbuka ([05 §1.6.6]),
 * sehingga kasir perlu tahu kapan boleh menutup aplikasi.
 */
export function StatusBar({ outletLabel }: { outletLabel: string }) {
  const staffName = usePosAuthStore((s) => s.staffName)
  const online = useOnlineStatus()
  const clockSkewMs = useSyncStore((s) => s.clockSkewMs)
  const syncing = useSyncStore((s) => s.syncing)
  const deviceRejected = useSyncStore((s) => s.deviceRejected)

  const queued = useLiveQuery(async () => {
    const [transactions, shifts, wastes] = await Promise.all([
      countUnsyncedTransactions(),
      countUnsyncedShifts(),
      countUnsyncedWastes(),
    ])
    return transactions + shifts + wastes
  }, [], 0)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-surface-inverse px-3 text-fg-inverse">
      <Button
        variant="ghost"
        size="icon"
        className="text-fg-inverse hover:bg-fg-inverse/10"
        aria-label="Pengaturan"
        onClick={() => posNavigate('settings')}
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <span className="truncate text-pos-sm font-semibold">{outletLabel}</span>

      <div className="ml-auto flex items-center gap-3">
        {clockSkewMs !== null && Math.abs(clockSkewMs) > 0 ? (
          <button
            type="button"
            onClick={() => posNavigate('settings')}
            className="flex items-center gap-1 rounded-sm bg-warning px-2 py-0.5 text-pos-xs font-medium text-fg"
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Jam melenceng {formatSkewMinutes(clockSkewMs)} mnt
          </button>
        ) : null}

        {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]). */}
        <span className="flex items-center gap-1 text-pos-xs">
          {online ? (
            <>
              <Wifi className="size-3.5" aria-hidden="true" />
              Online
            </>
          ) : (
            <>
              <CloudOff className="size-3.5" aria-hidden="true" />
              Offline
            </>
          )}
        </span>

        <button
          type="button"
          onClick={() => posNavigate('sync-status')}
          className={cn(
            'flex items-center gap-1 rounded-sm px-2 py-0.5 text-pos-xs',
            deviceRejected
              ? 'bg-danger font-semibold text-fg-inverse'
              : queued > 0
                ? 'bg-warning text-fg'
                : 'text-fg-inverse/80',
          )}
        >
          {deviceRejected ? (
            <>
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              Perangkat ditolak
            </>
          ) : (
            <>
              <RefreshCw
                className={cn('size-3.5', syncing && 'animate-spin')}
                aria-hidden="true"
              />
              <Num>{queued > 99 ? '99+' : queued}</Num> antre
            </>
          )}
        </button>

        {staffName ? <span className="text-pos-xs text-fg-inverse/80">{staffName}</span> : null}
      </div>
    </header>
  )
}

/**
 * `navigator.onLine` sebagai sumber eksternal.
 *
 * Nilainya optimistis — `true` hanya berarti ada antarmuka jaringan aktif,
 * bukan bahwa server terjangkau. Itu sebabnya mesin sync tetap menangani
 * kegagalan request alih-alih mempercayai flag ini.
 */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

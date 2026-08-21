'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CloudOff, Printer, RefreshCw, ShieldAlert, Wifi } from 'lucide-react'
import * as React from 'react'

import { Num } from '@/components/ui/money'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { useUnprintedCount } from '@/features/pos/printing/usePrintQueue'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { useConnectivityStatus } from '@/features/pos/sync/useConnectivity'
import {
  countUnsyncedTransactions,
  countUnsyncedWastes,
} from '@/lib/db/repositories/transaction.repo'
import { countUnsyncedShifts } from '@/lib/db/repositories/shift.repo'
import { CONNECTIVITY_LABEL } from '@/lib/sync/connectivity-store'
import { formatSkewMinutes, formatTimeId } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

/**
 * StatusBar POS — docs/06 §4.7, direduksi pada Fase M17.1 (**butir 18**).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KONTEKS SAJA — NOL AKSI, KECUALI LONCENG STRUK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Header ini dulu memuat tombol menu (☰), lencana antrean yang dapat diketuk,
 * dan peringatan jam yang menavigasi ke Pengaturan. Ketiganya **dihapus** dan
 * pindah ke `PosBottomBar`.
 *
 * Alasannya bukan estetika. Header berada di luar zona jempol pada handheld 6"
 * yang dipegang satu tangan; setiap ikon di sana memaksa penyesuaian genggaman,
 * puluhan kali per jam. Itu biaya waktu per transaksi, dan yang membayarnya
 * kasir.
 *
 * Yang tersisa adalah empat hal yang harus SELALU terlihat tetapi tidak pernah
 * perlu diketuk: kasir bertugas, jam mulai shift, keadaan jaringan, dan antrean
 * sinkronisasi.
 *
 * ⛔ **SATU-SATUNYA** elemen yang dapat diketuk di berkas ini adalah lonceng
 * "struk belum tercetak". Ia dikecualikan karena mewakili kewajiban yang belum
 * selesai dan harus dapat ditindaklanjuti dari mana pun kasir berada
 * ([11 §M14.1]).
 *
 * DoD M17 mengaudit hal ini lewat `grep`: tidak boleh ada `Button` atau
 * `IconButton` lain di dalam komponen header POS.
 */
export function StatusBar({ outletLabel }: { outletLabel: string }) {
  const staffName = usePosAuthStore((s) => s.staffName)
  // Selector sempit: indikator ini tidak perlu dirender ulang setiap kali
  // penghitung kegagalan bertambah ([11 §M12.1]).
  const connectivity = useConnectivityStatus()
  const clockSkewMs = useSyncStore((s) => s.clockSkewMs)
  const syncing = useSyncStore((s) => s.syncing)
  const deviceRejected = useSyncStore((s) => s.deviceRejected)

  const unprinted = useUnprintedCount()

  const queued = useLiveQuery(async () => {
    const [transactions, shifts, wastes] = await Promise.all([
      countUnsyncedTransactions(),
      countUnsyncedShifts(),
      countUnsyncedWastes(),
    ])
    return transactions + shifts + wastes
  }, [], 0)

  // Jam mulai shift — konteks, bukan aksi. Kasir memakainya untuk mencocokkan
  // dengan catatan serah terima tanpa harus membuka layar lain.
  const shiftStartedAt = useLiveQuery(
    async () => (await getOpenShift())?.client_opened_at ?? null,
    [],
    null,
  )

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-surface-inverse px-3 text-fg-inverse">
      {/* Identitas: siapa yang bertugas dan sejak jam berapa.
          Menggantikan tombol ☰ yang dulu ada di sini — menu pindah ke
          `PosBottomBar`. */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-pos-sm font-semibold">
          {staffName ?? outletLabel}
        </span>
        {shiftStartedAt ? (
          <span className="text-pos-xs text-fg-inverse/70">
            Shift {formatTimeId(shiftStartedAt)}
          </span>
        ) : (
          <span className="truncate text-pos-xs text-fg-inverse/70">{outletLabel}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {clockSkewMs !== null && Math.abs(clockSkewMs) > 0 ? (
          // Peringatan, BUKAN tombol. Dulu ia menavigasi ke Pengaturan;
          // sekarang ia hanya memberi tahu, dan Pengaturan dicapai lewat
          // bottom bar seperti menu lainnya.
          <span className="flex items-center gap-1 rounded-sm bg-warning px-2 py-0.5 text-pos-xs font-medium text-fg">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Jam melenceng {formatSkewMinutes(clockSkewMs)} mnt
          </span>
        ) : null}

        {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]).
            Tiga status, bukan dua: `degraded` adalah keadaan yang paling sering
            terjadi di lapangan (captive portal Wi-Fi) dan paling menyesatkan
            bila digambarkan sebagai "Online" ([11 §M12.1]). */}
        <span className="flex items-center gap-1 text-pos-xs">
          {connectivity === 'online' ? (
            <>
              <Wifi className="size-3.5" aria-hidden="true" />
              {CONNECTIVITY_LABEL.online}
            </>
          ) : connectivity === 'degraded' ? (
            <>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {CONNECTIVITY_LABEL.degraded}
            </>
          ) : (
            <>
              <CloudOff className="size-3.5" aria-hidden="true" />
              {CONNECTIVITY_LABEL.offline}
            </>
          )}
        </span>

        {/* Antrean sinkronisasi — indikator, bukan tombol. Status Sinkronisasi
            (P-13) dicapai lewat "Lainnya" pada bottom bar. */}
        <span
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
        </span>

        {/*
          ⛔ SATU-SATUNYA AKSI YANG BOLEH ADA DI HEADER ([11 §M17.1]).

          Lonceng struk mewakili kewajiban yang belum selesai — kertas yang
          seharusnya ada di tangan seseorang dan tidak ada. Ia dikecualikan dari
          aturan "header tanpa aksi" karena harus dapat ditindaklanjuti dari
          layar mana pun, termasuk layar yang menyembunyikan bottom bar.

          Hanya dirender ketika benar-benar ada yang tertinggal: tombol yang
          selalu ada akan berhenti berarti apa pun.
        */}
        {unprinted > 0 ? (
          <button
            type="button"
            onClick={() => posNavigate('sync-status')}
            aria-label={`${unprinted} struk belum tercetak`}
            className="flex items-center gap-1 rounded-sm bg-danger px-2 py-0.5 text-pos-xs font-semibold text-fg-inverse"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            <Num>{unprinted > 9 ? '9+' : unprinted}</Num>
          </button>
        ) : null}
      </div>
    </header>
  )
}

/**
 * @deprecated Sejak Fase M12.1 — pakai `useConnectivityStatus()` dari
 * `@/features/pos/sync/useConnectivity`.
 *
 * `navigator.onLine` bersifat optimistis: `true` hanya berarti ada antarmuka
 * jaringan aktif, bukan bahwa server terjangkau. Captive portal Wi-Fi ruko —
 * kasus yang paling sering di lapangan — melaporkan `true` sambil menolak
 * setiap permintaan. Store konektivitas menambahkan status `degraded` yang
 * membedakan keduanya berdasarkan BUKTI, yaitu permintaan yang benar-benar
 * gagal ([11 §M12.1]).
 *
 * Dipertahankan agar kode di luar POS tidak pecah; jangan dipakai di kode baru.
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

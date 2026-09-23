'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import * as React from 'react'

import { Skeleton } from '@/components/ui/feedback'
import { PosProviders } from '@/features/pos/PosProviders'
import { StatusBar } from '@/features/pos/components/StatusBar'
import { ShortcutHelp } from '@/features/pos/components/ShortcutHelp'
import { useKeyboardShortcuts } from '@/features/pos/hooks/useKeyboardShortcuts'
import { PosBottomBar } from '@/features/pos/components/PosBottomBar'
import { PrintQueueBanner } from '@/features/pos/printing/PrintQueueBanner'
import { usePrintQueueWatcher } from '@/features/pos/printing/usePrintQueue'
import { PosScreenOutlet } from '@/features/pos/router/PosScreenOutlet'
import { posNavigate, usePosHistorySync } from '@/features/pos/router/usePosRouter'
import { useConnectivityWatcher } from '@/features/pos/sync/useConnectivity'
import { useSyncTriggers } from '@/features/pos/sync/useSyncEngine'
import { useServiceWorker } from '@/features/pos/useServiceWorker'
import { getBoundOutletLabel, isDeviceBound } from '@/lib/auth/device-session'

/**
 * Root client SPA POS — docs/05 §1.1.3 (ADR-02).
 *
 * Satu-satunya komponen yang dirender oleh route `/pos`. Seluruh 13 layar
 * adalah client component yang dipilih `usePosRouter`, sehingga perpindahan
 * layar tidak pernah menyentuh jaringan.
 */
export function PosApp() {
  return (
    <PosProviders>
      <PosShell />
    </PosProviders>
  )
}

function PosShell() {
  usePosHistorySync()
  useServiceWorker()
  // Dipasang SEBELUM pemicu sync: gerbang jaringan mesin sync membaca store
  // konektivitas, dan store yang belum menyimak peristiwa OS akan menahan
  // putaran `startup` pada perangkat yang memang sedang offline ([11 §M12.1]).
  useConnectivityWatcher()
  useSyncTriggers()
  // Menangkap job cetak yang tertinggal dari sesi sebelumnya, lalu mencoba
  // mengirimnya ulang tanpa menunggu kasir menekan apa pun ([11 §M14.1]).
  usePrintQueueWatcher()

  const [helpOpen, setHelpOpen] = React.useState(false)
  useKeyboardShortcuts({
    onToggleHelp: () => setHelpOpen((open) => !open),
    onEscape: () => setHelpOpen(false),
    onPay: () => posNavigate('payment'),
    onHold: () => posNavigate('held-carts'),
  })

  // `undefined` = Dexie belum terbaca. Membedakannya dari `false` penting:
  // menampilkan layar "belum terikat" saat database masih dibuka akan membuat
  // perangkat yang sudah terpasang berkedip ke layar binding setiap kali dibuka.
  const bound = useLiveQuery(() => isDeviceBound(), [], undefined)
  const outletLabel = useLiveQuery(() => getBoundOutletLabel(), [], undefined)

  if (bound === undefined) {
    return (
      <div className="flex min-h-dvh flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  if (!bound) return <UnboundNotice />

  return (
    <div className="pos-root flex min-h-dvh flex-col bg-bg">
      {/* Header = KONTEKS. Nol aksi kecuali lonceng struk ([11 §M17.1]). */}
      <StatusBar outletLabel={outletLabel ?? 'Outlet'} />

      {/* Banner cetak menemukan rumah tetapnya di sini pada M17.1 — tepat di
          bawah header, di atas konten. Catatan "sementara" di M14.1 dapat
          dicabut. */}
      <PrintQueueBanner />

      <PosScreenOutlet />

      {/* Bottom bar = AKSI, di dalam zona jempol ([11 §M17.1]).
          Ia menyembunyikan dirinya sendiri pada alur pembayaran dan layar
          pra-shift — lihat `HIDDEN_ON`. */}
      <PosBottomBar />

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

/**
 * Perangkat belum diikat. Binding sengaja berada di route terpisah
 * (`/pos/bind`) karena hanya dipakai sekali, memerlukan jaringan, dan sebaiknya
 * berada di balik gerbang akses teknisi ([05 §1.1.3]).
 */
function UnboundNotice() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-[26rem] max-w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-elevated">
        <h1 className="text-pos-lg font-bold text-fg">Perangkat belum terpasang</h1>
        <p className="text-pos-sm text-fg-muted">
          Perangkat ini belum diikat ke outlet mana pun. Hubungi teknisi pemasang untuk menjalankan
          proses binding.
        </p>
        <a
          href="/pos/bind"
          className="mt-2 inline-flex h-touch-md items-center justify-center rounded-lg bg-accent px-6 text-pos-lg font-semibold text-fg-inverse"
        >
          Buka Halaman Pemasangan
        </a>
      </div>
    </main>
  )
}

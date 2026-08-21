'use client'

import { AlertTriangle, Check, Download } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Num } from '@/components/ui/money'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { syncMasterData, type MasterSyncResult } from '@/lib/sync/master-sync'

/**
 * P-02 Sync Master Data — docs/04 §A.1.
 *
 * Satu-satunya layar POS selain binding yang **memerlukan jaringan**. Setiap
 * pemanggilan menarik seluruh katalog: tidak ada sinkronisasi inkremental
 * (`updated_since`) di backend ([03 §2.2]).
 */
export function SyncMasterScreen() {
  const [state, setState] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = React.useState<MasterSyncResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const run = React.useCallback(async () => {
    setState('running')
    setError(null)
    try {
      setResult(await syncMasterData())
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sinkronisasi gagal')
      setState('error')
    }
  }, [])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-[28rem] max-w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-elevated">
        <div className="flex flex-col items-center gap-2 text-center">
          <Download className="size-8 text-accent" aria-hidden="true" />
          <h1 className="text-pos-lg font-bold text-fg">SINKRONISASI MASTER DATA</h1>
          <p className="text-pos-sm text-fg-muted">
            Mengunduh staff, kategori, dan produk outlet ini ke perangkat. Setelah selesai, kasir
            dapat bekerja tanpa jaringan.
          </p>
        </div>

        {state === 'done' && result ? (
          <ul className="flex flex-col gap-1 rounded-lg border border-border bg-bg-muted p-3 text-pos-sm">
            <SummaryRow label="Staff" value={result.staffs} />
            <SummaryRow label="Kategori" value={result.categories} />
            <SummaryRow label="Produk" value={result.products} />
            {result.pruned > 0 ? (
              <SummaryRow label="Data lama dibuang" value={result.pruned} />
            ) : null}
          </ul>
        ) : null}

        {state === 'error' ? (
          <p role="alert" className="flex items-start gap-1.5 text-pos-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {state === 'done' ? (
          <Button variant="primary" size="xl" block onClick={() => posNavigate('login')}>
            <Check className="size-5" aria-hidden="true" />
            LANJUT KE LOGIN KASIR
          </Button>
        ) : (
          <Button
            variant="primary"
            size="xl"
            block
            onClick={run}
            disabled={state === 'running'}
          >
            {state === 'running' ? 'Mengunduh…' : 'MULAI SINKRONISASI'}
          </Button>
        )}

        {/*
          ⛔ TOMBOL "LEWATI UNTUK SEKARANG" DIHAPUS PADA M15.1 (butir 10).
          ⛔ JANGAN DIKEMBALIKAN.

          Membuka shift dengan katalog kemarin berarti berjualan seharian pada
          harga yang sudah tidak berlaku, dan kerugiannya tidak dapat dikoreksi
          setelah pelanggan pulang.

          Tombol ini akan ditekan setiap pagi oleh kasir yang sedang terburu-buru
          — itulah persis mengapa ia tidak boleh ada. Gerbang di P-04
          (`lib/pos/master-gate.ts`) tetap memblokir bila unduhan belum pernah
          berhasil, sehingga melewati layar ini pun tidak menghasilkan jalan
          pintas; yang tersisa hanyalah kasir yang bingung mengapa shift-nya
          tidak dapat dibuka.
        */}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <Num className="font-semibold">{value}</Num>
    </li>
  )
}

'use client'

import { Printer } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Num } from '@/components/ui/money'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { usePrintQueue } from '@/features/pos/printing/usePrintQueue'
import { flushPrintQueue } from '@/lib/printer/print-queue'

/**
 * Banner persisten "N struk belum tercetak" ([11 §M14.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA PERSISTEN, BUKAN TOAST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toast hilang dalam tiga detik. Kasir yang sedang melayani antrean tidak akan
 * melihatnya, dan struk pembatalan yang gagal tercetak akan diketahui saat
 * tutup shift — ketika kertasnya sudah tidak mungkin lagi ditandatangani
 * supervisor yang sudah pulang.
 *
 * Banner ini menetap sampai antreannya benar-benar kosong. Ketidaknyamanannya
 * disengaja: ia mewakili kewajiban yang belum selesai.
 *
 * Ditempatkan tepat di bawah StatusBar — rumah tetapnya sejak M17.1
 * ([11 §M17.1]). Sengaja BUKAN di dalam `PosBottomBar`: bar itu menyembunyikan
 * dirinya pada alur pembayaran dan layar pra-shift, sedangkan struk yang belum
 * tercetak harus terlihat di SETIAP layar. Lonceng ringkas di `StatusBar`
 * adalah padanannya untuk layar yang bar-nya tersembunyi.
 */
export function PrintQueueBanner() {
  const { unprinted, flushing } = usePrintQueue()

  if (unprinted === 0) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-warning/40 bg-warning-subtle px-3 py-2">
      <Printer className="size-5 shrink-0 text-warning-text" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-pos-sm font-semibold text-fg">
          <Num>{unprinted}</Num> struk belum tercetak
        </span>
        <span className="truncate text-pos-xs text-fg-muted">
          Datanya tetap tersimpan. Ketuk untuk mencetak ulang.
        </span>
      </div>

      <Button
        variant="neutral"
        size="sm"
        disabled={flushing}
        onClick={() => void flushPrintQueue()}
      >
        {flushing ? 'Mencetak…' : 'Cetak Ulang'}
      </Button>

      <Button variant="ghost" size="sm" onClick={() => posNavigate('sync-status')}>
        Rincian
      </Button>
    </div>
  )
}

'use client'

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { cartTotal } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { commitPayment } from '@/features/pos/payment/commit-payment'
import { tenderedTotal, usePaymentDraftStore } from '@/features/pos/payment/payment-draft-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants/payment'

/**
 * P-06c Bayar Terpisah — **butir 8** ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SPLIT ADALAH DAFTAR TENDER, BUKAN METODE PEMBAYARAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SPLIT` tidak pernah muncul sebagai pilihan metode di layar mana pun — ia
 * adalah RINGKASAN atas dua tender atau lebih. Menaruhnya di daftar metode
 * berarti kasir dapat memilih "Split" lalu tidak ada satu pun baris tender yang
 * lahir untuk menjelaskannya, dan rekonsiliasi EDC kehilangan seluruh jejaknya.
 *
 * Layar ini karena itu menyusun DAFTAR: setiap tender ditambahkan lewat layar
 * metodenya sendiri (yang menegakkan aturan butir 8 untuk kartu), dan
 * `commitPayment()` yang menyimpulkan ringkasannya.
 *
 * ⚠️ Transaksi hanya dapat diselesaikan ketika `Σ tenders === total`. Kelebihan
 * maupun kekurangan sama-sama ditolak: kelebihan berarti kembalian yang tidak
 * tercatat, kekurangan berarti tagihan yang tidak tertutup.
 */
export function PaymentSplitScreen() {
  const lines = useCartStore((s) => s.lines)
  const tenders = usePaymentDraftStore((s) => s.tenders)
  const removeTender = usePaymentDraftStore((s) => s.removeTender)
  const [saving, setSaving] = React.useState(false)

  const total = cartTotal(lines)
  const tendered = tenderedTotal(tenders)
  const remaining = total - tendered
  const balanced = remaining === 0 && tenders.length > 0

  const submit = async () => {
    setSaving(true)
    try {
      const outcome = await commitPayment({ tenders })
      if (!outcome.ok) toast.error(outcome.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('payment')} disabled={saving}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Ganti metode
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Bayar Terpisah</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-pos-base text-fg-muted">Total transaksi</span>
          <Money minor={total} size="lg" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-pos-base text-fg-muted">Sudah dibayar</span>
          <Money minor={tendered} size="lg" tone="muted" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-pos-base font-semibold text-fg">Sisa</span>
          <Money
            minor={remaining}
            size="2xl"
            tone={remaining === 0 ? 'success' : remaining < 0 ? 'danger' : 'default'}
          />
        </div>
        {remaining < 0 ? (
          <p role="alert" className="text-pos-sm text-danger">
            ⚠ Pembayaran melebihi total. Hapus salah satu tender lalu masukkan nominal yang benar.
          </p>
        ) : null}
      </div>

      {tenders.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Belum ada pembayaran dicatat"
          description="Tambahkan tender satu per satu — tunai, kartu, atau QRIS. Transaksi selesai ketika seluruh sisa tertutup."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tenders.map((tender, index) => (
            <li
              key={`${tender.method}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <Badge tone="neutral">
                <Num>{index + 1}</Num>
              </Badge>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-pos-base font-medium text-fg">
                  {PAYMENT_METHOD_LABELS[tender.method as PaymentMethod]}
                </span>
                {tender.traceNumber ? (
                  // Trace number ditampilkan supaya kasir dapat mencocokkannya
                  // dengan struk EDC di tangannya SEBELUM menyelesaikan
                  // transaksi — bukan berjam-jam kemudian saat tutup shift.
                  <span className="font-mono text-pos-xs text-fg-muted">
                    Trace {tender.traceNumber} · ····{tender.cardLast4}
                  </span>
                ) : null}
              </div>

              <Money minor={tender.amount} size="md" />

              <Button
                variant="ghost"
                size="icon"
                className="text-danger"
                aria-label={`Hapus tender ${index + 1}`}
                disabled={saving}
                onClick={() => removeTender(index)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <Button
          variant="neutral"
          size="xl"
          block
          disabled={saving}
          onClick={() => posNavigate('payment-card', { method: 'DEBIT' })}
        >
          <Plus className="size-5" aria-hidden="true" />
          Tambah Pembayaran
        </Button>
      ) : null}

      {tenders.length === 1 ? (
        <Banner tone="info">
          Satu tender saja tidak dicatat sebagai split — transaksi akan tersimpan dengan metode{' '}
          <strong>{PAYMENT_METHOD_LABELS[tenders[0]!.method as PaymentMethod]}</strong>.
        </Banner>
      ) : null}

      <Button
        variant="cash"
        size="cash"
        block
        className="mt-auto"
        disabled={saving || !balanced}
        onClick={submit}
      >
        {saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI'}
      </Button>
    </div>
  )
}

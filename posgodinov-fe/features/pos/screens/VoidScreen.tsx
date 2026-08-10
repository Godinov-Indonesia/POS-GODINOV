'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Money, Num, shortId } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { LocalTransaction } from '@/lib/db/models'
import { listTransactionsToday, voidTransaction } from '@/lib/db/repositories/transaction.repo'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-10 Void / Batalkan Transaksi — docs/06 §2.2.
 *
 * **Layar terpisah, bukan aksi inline**, dengan `cancel_notes` wajib dan
 * konfirmasi ganda. Void adalah aksi yang paling sulit dibatalkan di seluruh
 * aplikasi kasir.
 *
 * Transaksi tidak dihapus — hanya ditandai `CANCELLED` dan diantrekan ulang.
 * Bila server sudah menyimpannya sebagai `COMPLETED`, server akan mengembalikan
 * bahan baku ke inventori saat menerima status baru ([03 §2.3]).
 */
export function VoidScreen() {
  const transactions = useLiveQuery(
    () => listTransactionsToday(),
    [],
    [] as LocalTransaction[],
  )

  const [selected, setSelected] = React.useState<LocalTransaction | null>(null)
  const [notes, setNotes] = React.useState('')
  const [confirming, setConfirming] = React.useState(false)

  const voidable = transactions.filter((t) => t.status === 'COMPLETED')

  const submit = async () => {
    if (!selected) return
    await voidTransaction(selected.id, notes.trim())
    toast.success('Transaksi dibatalkan dan diantrekan untuk sinkronisasi')
    setSelected(null)
    setNotes('')
    setConfirming(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Batalkan Transaksi</h1>
      </div>

      <Banner tone="warning" title="Pembatalan tidak dapat diurungkan">
        Transaksi yang sudah tersinkron akan dibatalkan di server, dan bahan bakunya dikembalikan ke
        inventori. Tidak ada cara mengembalikan transaksi ke status selesai dari perangkat ini.
      </Banner>

      {voidable.length === 0 ? (
        <EmptyState icon={Ban} title="Tidak ada transaksi yang dapat dibatalkan hari ini" />
      ) : (
        <ul className="flex flex-col gap-2">
          {voidable.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Num className="font-semibold">{shortId(transaction.id)}</Num>
                <span className="text-pos-xs text-fg-muted">
                  {formatDateTimeId(transaction.client_created_at)} ·{' '}
                  <Num>{transaction.items.length}</Num> item
                </span>
              </div>

              <Money minor={transaction.total_amount} size="lg" />

              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  setSelected(transaction)
                  setNotes('')
                }}
              >
                Batalkan
              </Button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-subtle p-4">
          <p className="text-pos-base font-semibold text-fg">
            Membatalkan <Num>{shortId(selected.id)}</Num> ·{' '}
            <Money minor={selected.total_amount} size="md" />
          </p>

          <Field label="Alasan pembatalan" htmlFor="cancel-notes" required>
            <Textarea
              id="cancel-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: pelanggan membatalkan pesanan sebelum disajikan"
            />
          </Field>

          <div className="flex items-center gap-6">
            <Button variant="neutral" onClick={() => setSelected(null)}>
              Batal
            </Button>
            <Button variant="danger" disabled={!notes.trim()} onClick={() => setConfirming(true)}>
              Lanjutkan Pembatalan
            </Button>
          </div>
        </div>
      ) : null}

      {/* Konfirmasi ganda ([06 §2.2]). */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        confirmLabel="Ya, batalkan transaksi"
        title="Konfirmasi terakhir"
        description="Setelah ini, transaksi ditandai CANCELLED dan akan dikirim ke server pada sinkronisasi berikutnya. Pastikan uang sudah dikembalikan kepada pelanggan."
      />
    </div>
  )
}

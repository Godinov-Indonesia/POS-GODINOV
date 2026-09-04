'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban, Undo2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { VoidSheet } from '@/features/pos/components/VoidSheet'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { LocalTransaction } from '@/lib/db/models'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { returnedQuantities } from '@/lib/db/repositories/return.repo'
import { listTransactionsToday, voidTransaction } from '@/lib/db/repositories/transaction.repo'
import {
  decideCancellation,
  FORBIDDEN_MESSAGE,
  type CancellationDecision,
} from '@/lib/pos/cancellation/decide'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-10 Batalkan Transaksi — docs/06 §2.2, dirombak pada Fase M13.2.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYAR INI TIDAK LAGI MEMUTUSKAN APA PUN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sebelumnya ia menyaring sendiri: `transactions.filter(t => t.status ===
 * 'COMPLETED')`. Kini seluruh keputusan datang dari `decideCancellation()`
 * ([11 §M13.1]) — layar hanya merender hasilnya dan mengarahkan ke alur yang
 * benar.
 *
 * Konsekuensinya terlihat pada transaksi yang struknya **sudah tercetak**:
 * tombolnya bukan "Batalkan" melainkan "Retur", dan tidak ada jalan dari layar
 * ini menuju Void untuknya. Itulah butir 15 dalam bentuk yang dilihat kasir.
 */
export function VoidScreen() {
  const transactions = useLiveQuery(() => listTransactionsToday(), [], [] as LocalTransaction[])
  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)

  const [selected, setSelected] = React.useState<LocalTransaction | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Keputusan dihitung untuk SETIAP baris, bukan hanya baris terpilih: label
  // tombolnya sendiri sudah merupakan hasil keputusan.
  const decisions = useLiveQuery(async () => {
    const map = new Map<string, CancellationDecision>()
    for (const transaction of transactions) {
      map.set(
        transaction.id,
        decideCancellation(transaction, await returnedQuantities(transaction.id)),
      )
    }
    return map
  }, [transactions], new Map<string, CancellationDecision>())

  const submit = async ({
    reasonCode,
    reasonNotes,
  }: {
    reasonCode: string
    reasonNotes: string
  }) => {
    if (!selected || !staffId) return

    setBusy(true)
    try {
      const shift = await getOpenShift()
      if (!shift) {
        toast.error('Tidak ada shift aktif — pembatalan harus terikat pada satu shift.')
        return
      }

      // Keputusan diambil ULANG tepat sebelum menulis. Antara render dan
      // ketukan, sebuah retur dari perangkat lain bisa saja tersinkron, atau
      // struknya baru selesai tercetak — dan keduanya mengubah jawabannya.
      const fresh = decideCancellation(selected, await returnedQuantities(selected.id))
      if (fresh.kind !== 'VOID') {
        toast.error(
          fresh.kind === 'RETURN'
            ? 'Struk transaksi ini sudah tercetak — gunakan alur Retur.'
            : FORBIDDEN_MESSAGE[fresh.reason],
        )
        setSelected(null)
        return
      }

      await voidTransaction({
        transactionId: selected.id,
        shiftId: shift.id,
        staffId,
        reasonCode,
        reasonNotes,
        // Nama dicetak; id disimpan. Struk yang hanya memuat UUID tidak dapat
        // dibaca supervisor yang memeriksanya di laci.
        cashierName: staffName ?? undefined,
      })

      toast.success('Transaksi dibatalkan. Struk pembatalan sedang dicetak.')
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  const actionable = transactions.filter(
    (t) => decisions.get(t.id)?.kind !== 'FORBIDDEN',
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Batalkan Transaksi</h1>
      </div>

      <Banner tone="warning" title="Struk menentukan jalurnya, bukan waktu">
        Transaksi yang <strong>belum</strong> tercetak dapat dibatalkan (Void). Yang{' '}
        <strong>sudah</strong> tercetak hanya dapat diretur — strukmya sudah berpindah ke pelanggan,
        dan mengubah transaksi asal berarti menerbitkan versi kedua yang bertentangan dengan kertas
        di tangan mereka. Keduanya mencetak struk untuk audit.
      </Banner>

      {actionable.length === 0 ? (
        <EmptyState icon={Ban} title="Tidak ada transaksi yang dapat dibatalkan hari ini" />
      ) : (
        <ul className="flex flex-col gap-2">
          {actionable.map((transaction) => {
            const decision = decisions.get(transaction.id)
            const isReturn = decision?.kind === 'RETURN'

            return (
              <li
                key={transaction.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <Num className="font-semibold">
                    {transaction.short_code ?? shortId(transaction.id)}
                  </Num>
                  <span className="text-pos-xs text-fg-muted">
                    {formatDateTimeId(transaction.client_created_at)} ·{' '}
                    <Num>{transaction.items.length}</Num> item
                  </span>
                  {isReturn ? (
                    <Badge tone="neutral" className="mt-1 w-fit">
                      Struk sudah tercetak
                    </Badge>
                  ) : null}
                </div>

                <Money minor={transaction.total_amount} size="lg" />

                {isReturn ? (
                  <Button
                    variant="neutral"
                    size="lg"
                    onClick={() =>
                      posNavigate('return', { transactionId: transaction.id })
                    }
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                    Retur
                  </Button>
                ) : (
                  <Button variant="danger" size="lg" onClick={() => setSelected(transaction)}>
                    Batalkan
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <VoidSheet
        open={!!selected}
        title="Batalkan transaksi"
        description={
          selected ? (
            <>
              Transaksi <Num>{selected.short_code ?? shortId(selected.id)}</Num> akan ditandai
              dibatalkan dan bahan bakunya dikembalikan ke inventori saat tersinkron. Pastikan uang
              sudah dikembalikan kepada pelanggan.
            </>
          ) : null
        }
        valueMinor={selected?.total_amount ?? 0}
        requiresAuth={requiresAuthFor(selected ? decisions.get(selected.id) : undefined)}
        busy={busy}
        submitLabel="Ya, batalkan transaksi"
        onClose={() => setSelected(null)}
        onSubmit={submit}
      />
    </div>
  )
}

/**
 * `requiresAuth` hanya ada pada keputusan VOID dan RETURN.
 *
 * Helper kecil ini menggantikan penyempitan tipe berlapis di dalam JSX, yang
 * tidak dapat dibaca dan — lebih penting — memancing `!` non-null yang
 * menyembunyikan kasus FORBIDDEN.
 */
function requiresAuthFor(decision: CancellationDecision | undefined): boolean {
  if (!decision) return false
  return decision.kind === 'FORBIDDEN' ? false : decision.requiresAuth
}

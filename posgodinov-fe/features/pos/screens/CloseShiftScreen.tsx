'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { summarizeShift } from '@/features/pos/shift/shift-math'
import { runSync } from '@/features/pos/sync/useSyncEngine'
import { closeShift, getOpenShift } from '@/lib/db/repositories/shift.repo'
import { listTransactionsByShift } from '@/lib/db/repositories/transaction.repo'

/**
 * P-12 Tutup Shift — docs/04 §A.3.
 *
 * `expected_balance` dan `discrepancy` dihitung **di klien**; server tidak
 * menghitung ulang, padahal `discrepancy` inilah yang muncul di dashboard
 * pemilik. Setelah shift ditutup, sync dipicu langsung — ini momen paling
 * penting untuk mengirim data, karena laci sudah dihitung ([05 §1.6.4]).
 */
export function CloseShiftScreen() {
  const shift = useLiveQuery(() => getOpenShift(), [], undefined)
  const transactions = useLiveQuery(
    () => (shift ? listTransactionsByShift(shift.id) : Promise.resolve([])),
    [shift?.id],
    [],
  )

  const { digits, append, backspace, clear } = useDigitInput(9)
  const [confirming, setConfirming] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const logout = usePosAuthStore((s) => s.logout)

  if (shift === undefined) return <Skeleton className="m-4 h-96" />

  if (!shift) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-pos-base text-fg-muted">Tidak ada shift terbuka.</p>
        <Button variant="primary" size="xl" onClick={() => posNavigate('login')}>
          Kembali ke Login
        </Button>
      </div>
    )
  }

  const summary = summarizeShift({
    openingBalanceMinor: shift.opening_balance,
    transactions,
  })

  const closingMinor = digitsToMinor(digits)
  const discrepancy = closingMinor - summary.expectedBalanceMinor

  const submit = async () => {
    setSaving(true)
    try {
      await closeShift({
        shiftId: shift.id,
        closingBalanceMinor: closingMinor,
        expectedBalanceMinor: summary.expectedBalanceMinor,
      })

      // Dipanggil langsung, bukan menunggu interval 5 menit.
      void runSync('shift-close')

      logout()
      posNavigate('login')
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row">
      <div className="flex flex-col gap-3 lg:w-[26rem]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => posNavigate('register')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali
          </Button>
          <h1 className="text-pos-lg font-bold text-fg">Tutup Shift</h1>
        </div>

        <dl className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-pos-sm">
          <Row label="Modal awal">
            <Money minor={shift.opening_balance} size="md" />
          </Row>
          <Row label="Penjualan tunai">
            <Money minor={summary.cashSalesMinor} size="md" />
          </Row>
          <Row label="Penjualan non-tunai">
            <Money minor={summary.nonCashSalesMinor} size="md" tone="muted" />
          </Row>
          <Row label="Transaksi selesai">
            <Num>{summary.completedCount}</Num>
          </Row>
          <Row label="Transaksi dibatalkan">
            <Num>{summary.cancelledCount}</Num>
          </Row>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-semibold text-fg">Seharusnya di laci</dt>
            <dd>
              <Money minor={summary.expectedBalanceMinor} size="xl" />
            </dd>
          </div>
        </dl>

        <Banner tone="info">
          Hanya transaksi <strong>tunai</strong> yang memengaruhi isi laci. QRIS, kartu debit, dan
          transfer tidak pernah menambah uang fisik.
        </Banner>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-pos-base text-fg-muted">Uang fisik dihitung</span>
            <Money minor={closingMinor} size="2xl" />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-pos-base text-fg-muted">Selisih</span>
            <Money
              minor={discrepancy}
              size="2xl"
              signed
              tone={discrepancy < 0 ? 'danger' : discrepancy > 0 ? 'success' : 'default'}
            />
          </div>
        </div>

        <div className="max-w-xs">
          <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={saving} />
        </div>

        <Button
          variant="danger"
          size="xl"
          block
          className="mt-auto"
          disabled={saving || !digits}
          onClick={() => setConfirming(true)}
        >
          TUTUP SHIFT
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        pending={saving}
        confirmLabel="Tutup shift"
        title="Tutup shift sekarang?"
        description="Shift akan ditandai CLOSED dan diantrekan untuk dikirim ke server. Selisih kas yang tercatat akan muncul di dashboard pemilik dan tidak dapat diubah dari perangkat ini."
      />
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

'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { openShift } from '@/lib/db/repositories/shift.repo'

/**
 * P-04 Buka Shift — docs/04 §A.3.
 *
 * Sepenuhnya offline. `shift.id` dibuat di sini (UUID v4) dan **tidak pernah**
 * diregenerasi — `shifts.id` tidak punya DEFAULT di database, dan setiap
 * transaksi kelak merujuknya lewat foreign key.
 */
export function OpenShiftScreen() {
  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)
  const { digits, append, backspace, clear } = useDigitInput(9)
  const [saving, setSaving] = React.useState(false)

  const openingMinor = digitsToMinor(digits)

  const submit = async () => {
    if (!staffId) return
    setSaving(true)
    try {
      await openShift({ staffId, openingBalanceMinor: openingMinor })
      posNavigate('register')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-[26rem] max-w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-elevated">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-pos-lg font-bold text-fg">BUKA SHIFT</h1>
          <p className="text-pos-sm text-fg-muted">Kasir: {staffName ?? '—'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-pos-sm font-medium text-fg">Modal awal laci</span>
          <div className="flex h-20 items-center justify-end rounded-md border border-border-strong bg-bg-muted px-4">
            <Money minor={openingMinor} size="2xl" />
          </div>
        </div>

        <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={saving} />

        <p className="text-pos-xs text-fg-muted">
          Hitung uang fisik di laci sekarang. Angka ini menjadi dasar perhitungan selisih kas saat
          shift ditutup, dan tidak dapat diubah setelah shift berjalan.
        </p>

        <Button
          variant="primary"
          size="xl"
          block
          onClick={submit}
          disabled={saving || !staffId}
        >
          {saving ? 'Membuka…' : 'BUKA SHIFT'}
        </Button>
      </div>
    </div>
  )
}

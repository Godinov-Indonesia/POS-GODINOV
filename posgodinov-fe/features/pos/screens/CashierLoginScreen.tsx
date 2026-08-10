'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { verifyPin } from '@/features/pos/auth/pin-verifier'
import { Keypad, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { PIN_MAX_LENGTH } from '@/lib/constants/limits'
import { findStaffByIdentifier } from '@/lib/db/repositories/master.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { cn } from '@/lib/utils/cn'

/**
 * P-03 Login Kasir — docs/06 §3.6, docs/04 §A.3.
 *
 * **100% offline.** Backend tidak punya endpoint login kasir; verifikasi
 * dilakukan dengan `bcrypt.compare` terhadap `pin_hash` dari master data,
 * dijalankan di Web Worker (ADR-08).
 */
export function CashierLoginScreen() {
  const [identifier, setIdentifier] = React.useState('')
  const { digits: pin, append, backspace, clear } = useDigitInput(PIN_MAX_LENGTH)
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError(null)

    try {
      const staff = await findStaffByIdentifier(identifier)

      // Pesan sengaja disamakan untuk ID tidak ada dan PIN salah — mencegah
      // penebakan daftar staff dari layar yang terpasang di area publik.
      const ok = staff ? await verifyPin(pin, staff.pin_hash) : false

      if (!staff || !ok) {
        setError('ID atau PIN salah')
        clear()
        return
      }

      usePosAuthStore.getState().login({ id: staff.id, name: staff.name })

      // Shift OPEN yang ditinggalkan sesi sebelumnya diteruskan, bukan
      // digandakan — satu perangkat hanya boleh punya satu laci terbuka.
      const openShift = await getOpenShift()
      posNavigate(openShift ? 'register' : 'open-shift')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="flex w-[26rem] max-w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-elevated"
      >
        <h1 className="text-center text-pos-lg font-bold text-fg">MASUK SEBAGAI KASIR</h1>

        <Field label="ID / Username Staff" htmlFor="staff-identifier">
          <Input
            id="staff-identifier"
            className="h-14 font-mono text-pos-md"
            autoCapitalize="none"
            autoComplete="off"
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-pos-sm font-medium text-fg">PIN (4–6 digit)</span>
          <PinSlots length={PIN_MAX_LENGTH} filled={pin.length} />
        </div>

        <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={checking} />

        {error ? (
          <p role="alert" className="flex items-center justify-center gap-1.5 text-pos-sm text-danger">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="xl"
          block
          disabled={checking || !identifier.trim() || pin.length < 4}
        >
          {checking ? 'Memeriksa…' : 'MASUK'}
        </Button>

        {/* Tidak ada tautan "Reset PIN" — endpointnya tidak ada ([05 §3.5]). */}
        <p className="text-center text-pos-sm text-fg-muted">
          Lupa PIN? Hubungi pemilik untuk membuat ulang akun staff.
        </p>
      </form>
    </div>
  )
}

function PinSlots({ length, filled }: { length: number; filled: number }) {
  return (
    <div
      className="flex h-14 items-center justify-center gap-3 rounded-md border border-border-strong bg-bg-muted"
      role="status"
      aria-label={`${filled} dari maksimal ${length} digit dimasukkan`}
    >
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-3 rounded-full',
            i < filled ? 'bg-fg' : 'bg-border-strong',
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

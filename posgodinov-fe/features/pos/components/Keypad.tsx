'use client'

import { Delete } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'

/**
 * Papan tombol angka — docs/06 §2.1 & §4.1.
 *
 * Tombol 56×56 px (`--spacing-touch-md`, kelas "Sering"): salah tekan di sini
 * menghasilkan kuantitas atau PIN salah yang masih terkoreksi, tetapi
 * memperlambat antrean.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function Keypad({
  onDigit,
  onClear,
  onBackspace,
  disabled,
}: {
  onDigit: (digit: string) => void
  onClear: () => void
  onBackspace: () => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <Button
          key={key}
          variant="keypad"
          size="lg"
          disabled={disabled}
          onClick={() => onDigit(key)}
          aria-label={`Angka ${key}`}
        >
          {key}
        </Button>
      ))}

      <Button variant="keypad" size="lg" disabled={disabled} onClick={onClear} aria-label="Hapus semua">
        C
      </Button>

      <Button variant="keypad" size="lg" disabled={disabled} onClick={() => onDigit('0')} aria-label="Angka 0">
        0
      </Button>

      <Button variant="keypad" size="lg" disabled={disabled} onClick={onBackspace} aria-label="Hapus satu digit">
        <Delete className="size-5" aria-hidden="true" />
      </Button>
    </div>
  )
}

/**
 * State untuk input numerik berbasis keypad.
 *
 * Nilai disimpan sebagai deretan digit, bukan number: `"007"` dan `"7"` harus
 * dapat dibedakan saat pengguna sedang mengetik, dan konversi hanya terjadi
 * saat dibaca.
 */
export function useDigitInput(maxLength = 12) {
  const [digits, setDigits] = React.useState('')

  const append = React.useCallback(
    (digit: string) => setDigits((prev) => (prev.length >= maxLength ? prev : prev + digit)),
    [maxLength],
  )

  const backspace = React.useCallback(() => setDigits((prev) => prev.slice(0, -1)), [])
  const clear = React.useCallback(() => setDigits(''), [])

  return { digits, setDigits, append, backspace, clear }
}

/** Digit Rupiah utuh → integer sen. `"22000"` → `2_200_000`. */
export const digitsToMinor = (digits: string): number => (Number(digits) || 0) * 100

'use client'

import * as React from 'react'

import { cn } from '@/lib/utils/cn'

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('text-pos-sm font-medium text-fg', className)} {...props}>
      {children}
      {required ? (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  )
}

export type FieldProps = {
  label: string
  htmlFor: string
  required?: boolean
  /** Petunjuk netral — batasan backend yang perlu diketahui operator. */
  hint?: React.ReactNode
  /** Pesan galat. Ditampilkan dengan ikon + teks, bukan warna saja ([06 §1.5]). */
  error?: string
  children: React.ReactNode
  className?: string
  /** Override tampilan label, mis. varian uppercase pada layar publik (auth). */
  labelClassName?: string
  /** Konten tambahan sejajar label, mis. tautan "Lupa password?". */
  labelAction?: React.ReactNode
}

/**
 * Pembungkus label + kontrol + pesan galat.
 *
 * Galat selalu punya **penanda kedua** selain warna: prefiks "⚠" dan teks.
 * 8% pria mengalami defisiensi penglihatan merah-hijau ([06 §1.5]).
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  labelClassName,
  labelAction,
}: FieldProps) {
  const errorId = `${htmlFor}-error`
  const hintId = `${htmlFor}-hint`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} required={required} className={labelClassName}>
          {label}
        </Label>
        {labelAction}
      </div>

      <div aria-describedby={cn(error && errorId, hint && hintId) || undefined}>{children}</div>

      {hint ? (
        <p id={hintId} className="text-pos-xs text-fg-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-pos-xs text-danger">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

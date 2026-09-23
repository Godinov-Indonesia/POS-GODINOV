'use client'

import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Kontrol input — docs/06 §2.1 & §4.
 *
 * Tinggi minimum 48px (`--spacing-touch`) berlaku juga di Admin: form Admin
 * sering diisi dari tablet di lapangan, bukan hanya desktop.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-touch w-full rounded-md border bg-surface px-3 text-pos-base text-fg',
        'placeholder:text-fg-subtle',
        'disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-fg-subtle',
        invalid ? 'border-danger' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  )
})

/**
 * Input numerik: `inputmode` memunculkan papan tombol angka di tablet, dan
 * selector `.tnum` di globals.css otomatis memberinya `tabular-nums`.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, InputProps>(function NumericInput(
  { className, ...props },
  ref,
) {
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      className={cn('text-right font-mono', className)}
      {...props}
    />
  )
})

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-touch-md w-full rounded-md border bg-surface p-3 text-pos-base text-fg',
        'placeholder:text-fg-subtle',
        invalid ? 'border-danger' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  )
})

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-touch w-full rounded-md border bg-surface px-3 text-pos-base text-fg',
        invalid ? 'border-danger' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  )
})

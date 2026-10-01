'use client'

import * as React from 'react'

import { cn } from '@/lib/utils/cn'

export type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        checked ? 'bg-success-text' : 'bg-border-strong',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block size-5 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

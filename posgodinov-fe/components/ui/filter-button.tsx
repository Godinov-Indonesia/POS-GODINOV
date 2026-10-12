'use client'

import { ChevronDown, Filter, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

export type FilterButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  icon?: LucideIcon | null
  label: React.ReactNode
  badge?: React.ReactNode
  hasDropdown?: boolean
  isOpen?: boolean
  size?: 'sm' | 'md'
}

/**
 * Tombol filter reusable — docs/06 §4.1.
 *
 * Menampilkan label filter aktif, badge durasi/kuantitas, dan panah dropdown opsional.
 * Mengikuti token Godinov (Lapis 2): `bg-surface`, `border-border`, `text-fg`, dll.
 */
export const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(
  function FilterButton(
    {
      active = false,
      icon: Icon = Filter,
      label,
      badge,
      hasDropdown = false,
      isOpen = false,
      size = 'sm',
      className,
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-expanded={hasDropdown ? isOpen : undefined}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150 ease-out-pos select-none cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          size === 'sm'
            ? 'min-h-[2.375rem] px-3 text-pos-sm'
            : 'min-h-[2.75rem] px-3.5 text-pos-base',
          active
            ? 'border border-accent bg-accent-subtle text-accent shadow-xs'
            : 'border border-border-strong bg-surface text-fg shadow-xs hover:border-accent hover:bg-bg-muted',
          className,
        )}
        {...props}
      >
        {Icon ? (
          <Icon
            className={cn(
              'shrink-0',
              size === 'sm' ? 'size-4' : 'size-4.5',
              active ? 'text-accent' : 'text-fg-muted',
            )}
            aria-hidden="true"
          />
        ) : null}

        <span className="truncate">{label}</span>

        {badge !== undefined && badge !== null && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.25 text-[11px] font-semibold tabular-nums shrink-0',
              active
                ? 'bg-accent text-fg-inverse'
                : 'bg-bg-muted text-fg-muted border border-border',
            )}
          >
            {badge}
          </span>
        )}

        {hasDropdown && (
          <ChevronDown
            className={cn(
              'size-4 shrink-0 transition-transform duration-200',
              isOpen ? 'rotate-180 text-accent' : 'text-fg-subtle',
            )}
            aria-hidden="true"
          />
        )}
      </button>
    )
  },
)

export type FilterPillButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  badge?: React.ReactNode
  size?: 'sm' | 'md'
}

/**
 * Filter Pill Button untuk tabs & segmented filter bar.
 */
export const FilterPillButton = React.forwardRef<HTMLButtonElement, FilterPillButtonProps>(
  function FilterPillButton(
    { active = false, badge, size = 'sm', className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors cursor-pointer select-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]',
          size === 'sm'
            ? 'px-2.5 py-1.5 text-pos-xs'
            : 'px-3 py-2 text-pos-sm',
          active
            ? 'bg-accent text-fg-inverse shadow-xs font-semibold'
            : 'bg-surface text-fg-muted hover:bg-bg-muted hover:text-fg border border-border',
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {badge !== undefined && badge !== null && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.25 text-[10px] font-semibold tabular-nums shrink-0',
              active
                ? 'bg-white/20 text-white'
                : 'bg-bg-muted text-fg-muted',
            )}
          >
            {badge}
          </span>
        )}
      </button>
    )
  },
)

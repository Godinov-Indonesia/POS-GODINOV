'use client'

import { AlertTriangle, Calendar, Check, Clock, RotateCcw, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { FilterButton } from '@/components/ui/filter-button'
import { Input } from '@/components/ui/input'
import { REPORT_MAX_RANGE_DAYS, REPORT_PRESETS } from '@/lib/constants/limits'
import {
  formatDateId,
  formatDateRangeId,
  lastNDays,
  monthToDate,
  rangeLengthDays,
  todayKey,
  type DateRange,
} from '@/lib/time'
import { cn } from '@/lib/utils/cn'

export type DateRangeFilterProps = {
  value: DateRange
  onChange: (range: DateRange) => void
  maxDays?: number
  align?: 'left' | 'right'
  className?: string
  /**
   * Jika true, preset buttons juga ditampilkan langsung berdampingan
   * dengan tombol filter pada layar lebar.
   */
  inlinePresets?: boolean
}

/**
 * Filter rentang tanggal reusable dengan popover modern — docs/05 §1.8.3.
 *
 * Menggantikan DateRangePicker lama dengan UI yang kompak, elegan,
 * dan terproteksi batas keras backend (maks 7 hari).
 */
export function DateRangeFilter({
  value,
  onChange,
  maxDays = REPORT_MAX_RANGE_DAYS,
  align = 'right',
  className,
  inlinePresets = false,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Draft state untuk custom input di dalam popover
  const [draftStart, setDraftStart] = React.useState(value.start)
  const [draftEnd, setDraftEnd] = React.useState(value.end)

  // Sinkronkan draft ketika value dari luar berubah
  React.useEffect(() => {
    setDraftStart(value.start)
    setDraftEnd(value.end)
  }, [value.start, value.end])

  // Hitung durasi saat ini & draft
  const currentDays = rangeLengthDays(value)
  const draftDays = rangeLengthDays({ start: draftStart, end: draftEnd })
  const isDraftInvalid = draftDays < 1
  const isDraftOverLimit = draftDays > maxDays

  // Identifikasi preset aktif
  const activePreset = React.useMemo(() => {
    const today = todayKey()
    if (value.start === today && value.end === today) return 'Hari Ini'

    const sevenDays = lastNDays(7)
    if (value.start === sevenDays.start && value.end === sevenDays.end) return '7 Hari'

    const mtd = monthToDate()
    if (value.start === mtd.start && value.end === mtd.end) return 'Bulan Ini'

    return 'Kustom'
  }, [value.start, value.end])

  // Tutup saat klik di luar
  React.useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleApplyCustom = () => {
    if (isDraftInvalid || isDraftOverLimit) return
    onChange({ start: draftStart, end: draftEnd })
    setIsOpen(false)
  }

  const handleSelectPreset = (days: number | null) => {
    const next = days === null ? monthToDate() : lastNDays(days)
    setDraftStart(next.start)
    setDraftEnd(next.end)
    onChange(next)
    setIsOpen(false)
  }

  const formattedRange = formatDateRangeId(value)
  const displayLabel = `${activePreset}${activePreset !== 'Kustom' ? ` (${formattedRange})` : `: ${formattedRange}`}`

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center gap-2', className)}>
      {/* Preset cepat inline (jika diaktifkan) */}
      {inlinePresets && (
        <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-bg-muted/70 p-0.5">
          {REPORT_PRESETS.map((preset) => {
            const isActive = activePreset === preset.label
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectPreset(preset.days)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-pos-xs font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-surface text-accent shadow-xs font-semibold'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Tombol Filter Utama */}
      <FilterButton
        active={activePreset !== 'Kustom' || currentDays > 0}
        icon={Calendar}
        label={displayLabel}
        badge={`${currentDays} hr`}
        hasDropdown
        isOpen={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Pilih rentang tanggal filter"
        title="Buka filter rentang tanggal"
        className={cn(
          currentDays > maxDays &&
            'border-warning text-warning-text bg-warning-subtle hover:border-warning',
        )}
      />

      {/* Popover Menu Floating */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Filter Rentang Tanggal"
          className={cn(
            'absolute top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] sm:w-96 rounded-xl border border-border-strong bg-surface p-4 text-fg shadow-overlay animate-in fade-in zoom-in-95 duration-150',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {/* Header Popover */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-accent" aria-hidden="true" />
              <div>
                <h3 className="text-pos-sm font-semibold text-fg">Filter Rentang Tanggal</h3>
                <p className="text-[11px] text-fg-muted">Maks. {maxDays} hari per kueri</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-fg-subtle hover:bg-bg-muted hover:text-fg transition-colors"
              aria-label="Tutup popover"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="py-3">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-2 block">
              Pilihan Cepat
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {REPORT_PRESETS.map((preset) => {
                const isActive = activePreset === preset.label
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset.days)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-center transition-all cursor-pointer',
                      isActive
                        ? 'border-accent bg-accent-subtle text-accent font-semibold shadow-xs'
                        : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-bg-muted',
                    )}
                  >
                    <span className="text-pos-xs">{preset.label}</span>
                    <span className="text-[10px] text-fg-subtle">
                      {preset.days ? `${preset.days} hari` : 'Bulan berjalan'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Kustom Tanggal */}
          <div className="space-y-3 pt-2 border-t border-border">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle block">
              Kustom Rentang Tanggal
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-pos-xs text-fg-muted">Dari:</span>
                <Input
                  type="date"
                  value={draftStart}
                  max={draftEnd}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="h-9 text-pos-xs px-2"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-pos-xs text-fg-muted">Sampai:</span>
                <Input
                  type="date"
                  value={draftEnd}
                  min={draftStart}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="h-9 text-pos-xs px-2"
                />
              </div>
            </div>

            {/* Status & Validasi */}
            {isDraftInvalid ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-pos-xs text-danger rounded-md bg-danger-subtle p-2"
              >
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                Tanggal akhir mendahului tanggal mulai.
              </p>
            ) : isDraftOverLimit ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-pos-xs text-warning-text rounded-md bg-warning-subtle p-2"
              >
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                Rentang {draftDays} hari melebihi batas {maxDays} hari sistem.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-pos-xs text-fg-muted p-1">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                Rentang terpilih: <strong className="text-fg">{draftDays} hari</strong> (
                {formatDateId(draftStart)} – {formatDateId(draftEnd)})
              </p>
            )}

            {/* Aksi Terapkan */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 text-pos-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isDraftInvalid || isDraftOverLimit}
                onClick={handleApplyCustom}
                className="h-8 text-pos-xs"
              >
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { REPORT_MAX_RANGE_DAYS, REPORT_PRESETS } from '@/lib/constants/limits'
import { lastNDays, monthToDate, rangeLengthDays, type DateRange } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

/**
 * Pemilih rentang tanggal laporan — docs/05 §1.8.3.
 *
 * Batas 7 hari ditegakkan **keras**: tidak ada paginasi di endpoint laporan
 * mana pun, sehingga rentang lebar berarti payload puluhan megabita dalam satu
 * response. Preset "Semua waktu" sengaja tidak disediakan.
 *
 * Preset "Bulan Ini" boleh melebihi batas dan karena itu diberi peringatan —
 * ia berguna di awal bulan, berbahaya di akhir bulan.
 */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const length = rangeLengthDays(value)
  const overLimit = length > REPORT_MAX_RANGE_DAYS
  const invalid = length < 1

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {REPORT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.days === null ? monthToDate() : lastNDays(preset.days))}
            className={cn(
              'min-h-touch rounded-md border border-border bg-surface px-3 text-pos-sm',
              'hover:border-accent hover:bg-accent-subtle',
            )}
          >
            {preset.label}
          </button>
        ))}

        <label className="flex items-center gap-1.5">
          <span className="text-pos-sm text-fg-muted">Dari</span>
          <Input
            type="date"
            className="w-auto"
            value={value.start}
            max={value.end}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-pos-sm text-fg-muted">Sampai</span>
          <Input
            type="date"
            className="w-auto"
            value={value.end}
            min={value.start}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </label>
      </div>

      {invalid ? (
        <p role="alert" className="flex items-center gap-1.5 text-pos-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          Tanggal akhir mendahului tanggal mulai.
        </p>
      ) : overLimit ? (
        <p role="alert" className="flex items-center gap-1.5 text-pos-sm text-warning-text">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          Rentang {length} hari melebihi batas {REPORT_MAX_RANGE_DAYS} hari. Endpoint laporan tidak
          punya paginasi — persempit rentang sebelum memuat.
        </p>
      ) : null}
    </div>
  )
}

/** Banner wajib pada setiap layar laporan ([05 §0.4], [06 §3.8]). */
export function ServerTimeBanner() {
  return (
    <div
      role="note"
      className="flex gap-2.5 rounded-lg border border-warning border-l-4 bg-warning-subtle p-3 text-pos-sm text-fg"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden="true" />
      <p>
        Laporan dikelompokkan berdasarkan waktu data <strong>diterima server</strong>, bukan waktu
        transaksi terjadi di kasir. Transaksi offline yang baru tersinkronisasi akan muncul pada
        tanggal sinkronisasinya.
      </p>
    </div>
  )
}

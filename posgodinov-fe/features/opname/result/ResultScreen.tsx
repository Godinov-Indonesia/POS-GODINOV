'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { listResults } from '@/features/opname/session/opname.repo'
import type { OpnameResultLine, OpnameSession } from '@/lib/db/opname-models'
import { toMinor } from '@/lib/money'
import { formatDateTimeId } from '@/lib/time'

/**
 * **Fase KUNCI** — status `LOCKED` ([11 §M16.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SATU-SATUNYA LAYAR YANG BOLEH MENAMPILKAN ANGKA SISTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Seluruh angka di sini berasal dari respons `POST /lock` dan disimpan apa
 * adanya di Dexie. **Tidak satu pun dihitung ulang di klien** — menghitung
 * sendiri berarti perangkat gudang harus memegang stok sistem sepanjang fase
 * hitung, dan butir 3 runtuh sebelum layar ini sempat dibuka.
 *
 * Layar ini juga tidak menawarkan jalan kembali. Sesi terkunci adalah dokumen
 * yang sudah jadi; hitung ulang menempuh sesi BARU.
 */
export function ResultScreen({ session }: { session: OpnameSession }) {
  const results = useLiveQuery(() => listResults(session.id), [session.id], undefined)

  if (results === undefined) return <Skeleton className="m-4 h-96" />

  // Ringkasan dihitung dari baris yang DIKIRIM SERVER, bukan dari stok yang
  // dipegang klien — klien memang tidak memegangnya.
  const flagged = results.filter((r) => r.fraud_flag)
  const withVariance = results.filter((r) => r.difference !== 0)
  const totalValue = results.reduce((sum, r) => sum + r.difference_value, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        <Lock className="size-4 text-fg-muted" aria-hidden="true" />
        <span className="text-pos-sm text-fg-muted">
          Terkunci {session.locked_at ? formatDateTimeId(session.locked_at) : '—'}
        </span>
      </div>

      {flagged.length > 0 ? (
        <Banner tone="danger" title={`${flagged.length} bahan melewati ambang selisih`}>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Selisih ditandai ke <strong>dua arah</strong>. Kelebihan sama pentingnya dengan
            kekurangan: barang yang ada tetapi tidak tercatat berarti ada penerimaan yang tidak
            masuk sistem.
          </span>
        </Banner>
      ) : null}

      <dl className="grid grid-cols-3 gap-2">
        <SummaryCard label="Bahan dihitung" value={<Num>{results.length}</Num>} />
        <SummaryCard label="Ada selisih" value={<Num>{withVariance.length}</Num>} />
        <SummaryCard
          label="Nilai selisih"
          value={<Money minor={toMinor(totalValue)} size="md" signed />}
        />
      </dl>

      <Banner tone="info">
        Hasil ini menunggu persetujuan pemilik. Stok sistem <strong>belum</strong> disesuaikan —
        penyesuaian terjadi saat pemilik menyetujui sesi ini dari Dashboard.
      </Banner>

      <ul className="flex flex-col gap-2">
        {results.map((line) => (
          <ResultRow key={line.key} line={line} />
        ))}
      </ul>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3">
      <dt className="text-pos-xs text-fg-muted">{label}</dt>
      <dd className="text-pos-base font-semibold text-fg">{value}</dd>
    </div>
  )
}

function ResultRow({ line }: { line: OpnameResultLine }) {
  const short = line.difference < 0
  const exact = line.difference === 0

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border p-3 ${
        line.fraud_flag ? 'border-danger/40 bg-danger-subtle' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-pos-base font-medium text-fg">{line.raw_material_name}</span>
        {line.fraud_flag ? (
          <Badge tone="danger">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Melebihi ambang
          </Badge>
        ) : exact ? (
          <Badge tone="success">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            Cocok
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-pos-sm">
        <Figure label="Fisik" value={line.actual_stock} unit={line.unit} />
        <Figure label="Sistem" value={line.system_stock} unit={line.unit} muted />
        <div className="flex flex-col">
          <span className="text-pos-xs text-fg-muted">Selisih</span>
          <span
            className={`font-semibold ${
              exact ? 'text-fg' : short ? 'text-danger' : 'text-success'
            }`}
          >
            {line.difference > 0 ? '+' : ''}
            <Num>{line.difference}</Num> {line.unit}
          </span>
        </div>
      </div>

      {!exact ? (
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-pos-xs text-fg-muted">Nilai selisih</span>
          <Money
            minor={toMinor(line.difference_value)}
            size="sm"
            signed
            tone={short ? 'danger' : 'success'}
          />
        </div>
      ) : null}
    </li>
  )
}

function Figure({
  label,
  value,
  unit,
  muted,
}: {
  label: string
  value: number
  unit: string
  muted?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span className="text-pos-xs text-fg-muted">{label}</span>
      <span className={muted ? 'text-fg-muted' : 'font-semibold text-fg'}>
        <Num>{value}</Num> {unit}
      </span>
    </div>
  )
}

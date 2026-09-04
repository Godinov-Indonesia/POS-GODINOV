'use client'

import { AlertTriangle, EyeOff, ShieldAlert, Wallet } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toastApiError } from '@/components/ui/toaster'
import {
  DateRangePicker,
  ServerTimeBanner,
} from '@/features/admin/reports/components/DateRangePicker'
import { useDateRange, useShiftReconciliation } from '@/features/admin/reports/hooks/useReports'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import type { ShiftReconciliationView } from '@/lib/api/endpoints/reports'
import { formatDateTimeId, isRangeWithinLimit } from '@/lib/time'

/**
 * Rekonsiliasi Shift — layar **PEMILIK**, butir 9 ([11 §M15.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SATU-SATUNYA TEMPAT ANGKA EKSPEKTASI BOLEH TERLIHAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Blind Closing menyembunyikan `expected_*` dan selisih dari kasir — bukan dari
 * pemilik. Justru sebaliknya: menyembunyikannya dari kasir hanya berguna bila
 * ada yang membacanya di tempat lain.
 *
 * Layar ini berada di bundle Admin, di balik token Business. Batas itu bukan
 * sekadar organisasi berkas: `no-restricted-imports` melarang Admin menyentuh
 * database lokal POS dan sebaliknya ([05 §1.1.4]), sehingga tidak ada jalan
 * bagi angka ini merembes ke perangkat kasir lewat impor yang tidak sengaja.
 */
export function ShiftReconciliation() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Rekonsiliasi Shift"
        description="Perbandingan angka yang dideklarasikan kasir dengan catatan sistem."
      />
      <OutletGuard>{(outletId) => <ReconciliationContent outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function ReconciliationContent({ outletId }: { outletId: string }) {
  const [range, setRange] = useDateRange(7)
  const { data, isPending, error } = useShiftReconciliation(outletId, range)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat rekonsiliasi shift')
  }, [error])

  const rows = data ?? []
  const flaggedCount = rows.filter((r) => r.flagged).length

  return (
    <div className="flex flex-col gap-4">
      <DateRangePicker value={range} onChange={setRange} />
      <ServerTimeBanner />

      {!isRangeWithinLimit(range) ? (
        <Banner tone="warning" title="Rentang terlalu panjang">
          Persempit rentang menjadi maksimal 7 hari.
        </Banner>
      ) : null}

      {flaggedCount > 0 ? (
        <Banner tone="warning" title={`${flaggedCount} shift melewati ambang selisih`}>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Selisih ke <strong>dua arah</strong> ditandai. Laci yang berlebih sama pentingnya
            dengan yang kurang: kelebihan menandakan transaksi yang tidak tercatat, dan itu bentuk
            kebocoran yang tidak pernah dilaporkan siapa pun.
          </span>
        </Banner>
      ) : null}

      {isPending ? (
        <SkeletonTable rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada shift pada rentang ini"
          description="Shift muncul di sini setelah kasir menutupnya dan perangkatnya tersinkron."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Kasir / Shift</TH>
              <TH>Uang Laci</TH>
              <TH>EDC</TH>
              <TH>QRIS</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <ReconciliationRow key={row.shiftId} row={row} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

function ReconciliationRow({ row }: { row: ShiftReconciliationView }) {
  return (
    <TR className={row.flagged ? 'bg-danger-subtle' : undefined}>
      <TD>
        <div className="flex flex-col">
          <span className="font-medium text-fg">{row.staffName || '—'}</span>
          <span className="text-xs text-fg-muted">
            {formatDateTimeId(row.openedAt)}
            {row.closedAt ? ` → ${formatDateTimeId(row.closedAt)}` : ' → belum ditutup'}
          </span>
          <span className="font-mono text-xs text-fg-subtle">{row.deviceId}</span>
        </div>
      </TD>

      <VarianceCell
        declaredMinor={row.declaredCashMinor}
        expectedMinor={row.expectedCashMinor}
        varianceMinor={row.cashVarianceMinor}
        thresholdMinor={row.varianceThresholdMinor}
      />
      <VarianceCell
        declaredMinor={row.declaredEdcMinor}
        expectedMinor={row.expectedEdcMinor}
        varianceMinor={row.edcVarianceMinor}
        thresholdMinor={row.varianceThresholdMinor}
      />
      <VarianceCell
        declaredMinor={row.declaredQrisMinor}
        expectedMinor={row.expectedQrisMinor}
        varianceMinor={row.qrisVarianceMinor}
        thresholdMinor={row.varianceThresholdMinor}
      />

      <TD>
        <div className="flex flex-col items-start gap-1">
          {row.reconciledAt === null ? (
            <Badge tone="neutral">Belum direkonsiliasi</Badge>
          ) : row.flagged ? (
            <Badge tone="danger">Perlu ditinjau</Badge>
          ) : (
            <Badge tone="success">Dalam ambang</Badge>
          )}

          {/*
            Shift yang ditutup PAKSA ditandai terpisah. Angkanya nol bukan
            karena lacinya kosong, melainkan karena tidak ada yang
            menghitungnya — dan membacanya sebagai "selisih besar" akan
            menuduh kasir atas keadaan yang justru menimpanya.
          */}
          {!row.blindClose ? (
            <Badge tone="warning">
              <ShieldAlert className="size-3" aria-hidden="true" />
              Tutup paksa
            </Badge>
          ) : (
            <span className="flex items-center gap-1 text-xs text-fg-subtle">
              <EyeOff className="size-3" aria-hidden="true" />
              Blind close
            </span>
          )}
        </div>
      </TD>
    </TR>
  )
}

/**
 * Satu kelompok tender: deklarasi, ekspektasi, dan selisihnya.
 *
 * `null` pada ekspektasi berarti server **belum** merekonsiliasi shift ini.
 * Ditampilkan sebagai "—", bukan sebagai Rp 0: nol berarti "seharusnya kosong",
 * dan menampilkannya untuk shift yang belum dihitung akan membuat setiap
 * deklarasi tampak sebagai kelebihan uang sebesar nilai penuhnya.
 */
function VarianceCell({
  declaredMinor,
  expectedMinor,
  varianceMinor,
  thresholdMinor,
}: {
  declaredMinor: number
  expectedMinor: number | null
  varianceMinor: number | null
  thresholdMinor: number
}) {
  const exceeds = varianceMinor !== null && Math.abs(varianceMinor) > thresholdMinor

  return (
    <TD>
      <div className="flex flex-col gap-0.5 text-right">
        <span className="flex items-center justify-end gap-1">
          <span className="text-xs text-fg-muted">Deklarasi</span>
          <Money minor={declaredMinor} size="sm" />
        </span>

        <span className="flex items-center justify-end gap-1">
          <span className="text-xs text-fg-muted">Sistem</span>
          {expectedMinor === null ? (
            <span className="text-sm text-fg-subtle">—</span>
          ) : (
            <Money minor={expectedMinor} size="sm" tone="muted" />
          )}
        </span>

        {varianceMinor === null ? null : (
          <span className="flex items-center justify-end gap-1 border-t border-border pt-0.5">
            <span className="text-xs text-fg-muted">Selisih</span>
            <Money
              minor={varianceMinor}
              size="sm"
              signed
              tone={exceeds ? 'danger' : varianceMinor === 0 ? 'default' : 'muted'}
            />
          </span>
        )}
      </div>
    </TD>
  )
}

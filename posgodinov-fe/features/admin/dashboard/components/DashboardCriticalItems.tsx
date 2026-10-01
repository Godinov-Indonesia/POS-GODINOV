'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { Money, Num, formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import type { OpnameLogView } from '@/lib/types/inventory'
import type { RawMaterialView } from '@/lib/types/domain'
import type { WasteLogDto } from '@/lib/types/inventory'

export function DashboardCriticalItems({
  opnameLogs = [],
  rawMaterials = [],
  wasteLogs = [],
  isPending = false,
}: {
  opnameLogs?: OpnameLogView[]
  rawMaterials?: RawMaterialView[]
  wasteLogs?: WasteLogDto[]
  isPending?: boolean
}) {
  const [tab, setTab] = React.useState<'opname_minus' | 'low_stock' | 'waste'>(
    'opname_minus',
  )

  const materialMap = React.useMemo(() => {
    return new Map(rawMaterials.map((m) => [m.id, m]))
  }, [rawMaterials])

  // 1. Items with negative opname discrepancy (minus besar)
  const negativeOpnames = React.useMemo(() => {
    return opnameLogs
      .filter((log) => log.difference < 0)
      .sort((a, b) => {
        // Urutkan kerugian nilai rupiah terbesar dulu (nilai selisih minor paling negatif)
        return a.difference_value_minor - b.difference_value_minor
      })
      .slice(0, 10)
  }, [opnameLogs])

  // 2. Items with stock <= 0 (out of stock / negative system stock)
  const criticalStockMaterials = React.useMemo(() => {
    return rawMaterials
      .filter((m) => (m.stock ?? 0) <= 0)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .slice(0, 10)
  }, [rawMaterials])

  // 3. Waste logs breakdown
  const recentWastes = React.useMemo(() => {
    return wasteLogs
      .slice(0, 10)
      .sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0))
  }, [wasteLogs])

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" aria-hidden="true" />
            <CardTitle className="text-pos-md">Barang Perlu Perhatian</CardTitle>
          </div>
          <p className="mt-0.5 text-pos-xs text-fg-muted">
            Monitoring selisih opname minus, stok kritis, dan pemborosan bahan
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-lg border border-border bg-bg-muted p-0.5 text-pos-xs">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition-all ${
              tab === 'opname_minus'
                ? 'bg-surface text-fg shadow-sm font-semibold'
                : 'text-fg-muted hover:text-fg'
            }`}
            onClick={() => setTab('opname_minus')}
          >
            Minus Opname ({negativeOpnames.length})
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition-all ${
              tab === 'low_stock'
                ? 'bg-surface text-fg shadow-sm font-semibold'
                : 'text-fg-muted hover:text-fg'
            }`}
            onClick={() => setTab('low_stock')}
          >
            Stok Habis ({criticalStockMaterials.length})
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition-all ${
              tab === 'waste'
                ? 'bg-surface text-fg shadow-sm font-semibold'
                : 'text-fg-muted hover:text-fg'
            }`}
            onClick={() => setTab('waste')}
          >
            Waste ({recentWastes.length})
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-4 pt-0">
        {isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : tab === 'opname_minus' ? (
          /* TAB 1: MINUS OPNAME */
          negativeOpnames.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-8 text-success-text" aria-hidden="true" />
              <p className="text-pos-sm font-medium text-fg">Tidak ada selisih minus besar</p>
              <p className="text-pos-xs text-fg-muted max-w-sm">
                Seluruh catatan stock opname di outlet ini dalam kondisi pas atau surplus.
              </p>
              <Link
                href="/admin/inventory/opname/new"
                className={buttonVariants({ variant: 'neutral', size: 'sm', className: 'mt-2' })}
              >
                Mulai Opname Baru
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Bahan Baku</TH>
                      <TH numeric>Sistem</TH>
                      <TH numeric>Fisik</TH>
                      <TH numeric>Selisih</TH>
                      <TH numeric>Nilai Rugi</TH>
                      <TH className="text-right">Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {negativeOpnames.map((log) => {
                      const material = materialMap.get(log.raw_material_id)
                      const unit = material?.unit ?? ''

                      return (
                        <TR key={log.id}>
                          <TD className="font-semibold text-fg">
                            {material?.name ?? `ID: ${log.raw_material_id.slice(0, 8)}`}
                          </TD>
                          <TD numeric>
                            <Num>{formatQuantity(log.system_stock)}</Num>{' '}
                            <span className="text-pos-xs text-fg-subtle">{unit}</span>
                          </TD>
                          <TD numeric>
                            <Num>{formatQuantity(log.actual_stock)}</Num>{' '}
                            <span className="text-pos-xs text-fg-subtle">{unit}</span>
                          </TD>
                          <TD numeric>
                            <span className="font-mono font-bold text-danger">
                              {formatQuantity(log.difference)} {unit}
                            </span>
                          </TD>
                          <TD numeric>
                            <Money minor={log.difference_value_minor} tone="danger" signed />
                          </TD>
                          <TD className="text-right">
                            {log.fraud_flag ? (
                              <Badge tone="danger" icon={ShieldAlert}>
                                Anomali
                              </Badge>
                            ) : (
                              <Badge tone="warning">Minus</Badge>
                            )}
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </div>

              <div className="mt-2 flex justify-end">
                <Link
                  href="/admin/reports/opname"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Buka Laporan Opname Lengkap
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )
        ) : tab === 'low_stock' ? (
          /* TAB 2: STOK HABIS / KRITIS */
          criticalStockMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-8 text-success-text" aria-hidden="true" />
              <p className="text-pos-sm font-medium text-fg">Seluruh stok bahan baku aman</p>
              <p className="text-pos-xs text-fg-muted max-w-sm">
                Tidak ada bahan baku yang berada di angka 0 atau minus di outlet ini.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Bahan Baku</TH>
                      <TH>Kemasan / Unit</TH>
                      <TH numeric>Sisa Stok</TH>
                      <TH numeric>HPP</TH>
                      <TH className="text-right">Aksi</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {criticalStockMaterials.map((rm) => (
                      <TR key={rm.id}>
                        <TD className="font-semibold text-fg">{rm.name}</TD>
                        <TD className="text-pos-xs text-fg-muted">
                          {rm.package_unit ? `${rm.package_unit} (${rm.quantity_per_package} ${rm.unit})` : rm.unit}
                        </TD>
                        <TD numeric>
                          <span className="font-mono font-bold text-danger">
                            <Num>{formatQuantity(rm.stock ?? 0)}</Num> {rm.unit}
                          </span>
                        </TD>
                        <TD numeric>
                          <Money minor={rm.cost_per_unit_minor} size="sm" />
                        </TD>
                        <TD className="text-right">
                          <Link
                            href="/admin/inventory/restock"
                            className={buttonVariants({ variant: 'neutral', size: 'sm' })}
                          >
                            Restock
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              <div className="mt-2 flex justify-end">
                <Link
                  href="/admin/inventory"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Kelola Seluruh Bahan Baku
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )
        ) : recentWastes.length === 0 ? (
          /* TAB 3: WASTE LOGS */
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-success-text" aria-hidden="true" />
            <p className="text-pos-sm font-medium text-fg">Belum ada pencatatan waste</p>
            <p className="text-pos-xs text-fg-muted max-w-sm">
              Tidak ada bahan baku yang terbuang atau rusak yang dicatat pada outlet ini.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Bahan Baku</TH>
                      <TH numeric>Jumlah Terbuang</TH>
                      <TH>Alasan</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {recentWastes.map((w, idx) => {
                      const material = materialMap.get(w.raw_material_id)
                      return (
                        <TR key={`${w.raw_material_id}-${idx}`}>
                          <TD className="font-semibold text-fg">
                            {material?.name ?? `ID: ${w.raw_material_id.slice(0, 8)}`}
                          </TD>
                          <TD numeric>
                            <span className="font-mono font-semibold text-danger">
                              <Num>{formatQuantity(w.quantity)}</Num> {material?.unit ?? ''}
                            </span>
                          </TD>
                          <TD className="text-pos-sm text-fg-muted">{w.reason}</TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </div>

              <div className="mt-2 flex justify-end">
                <Link
                  href="/admin/reports/waste"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Buka Laporan Waste Lengkap
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  )
}

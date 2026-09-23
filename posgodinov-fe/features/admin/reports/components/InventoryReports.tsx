'use client'

import { AlertTriangle, FileBarChart, ShieldAlert, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money, Num, formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toastApiError } from '@/components/ui/toaster'
import {
  useOpnameLogs,
  useRestockLogs,
  useWasteLogs,
} from '@/features/admin/inventory/hooks/useInventoryOps'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { formatDateTimeId } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

/**
 * Ketiga laporan inventori mengembalikan **seluruh riwayat** tanpa filter
 * tanggal maupun paginasi ([03 §8.3, §9.3, §10.3]). Banner di bawah menyatakan
 * itu apa adanya, karena pertumbuhan payload akan terasa seiring waktu.
 */
function NoFilterBanner() {
  return (
    <Banner tone="info">
      Endpoint ini mengembalikan <strong>seluruh riwayat</strong> outlet — tidak ada filter tanggal
      maupun paginasi di backend. Waktu muat akan bertambah seiring bertambahnya data.
    </Banner>
  )
}

/** Nama bahan baku digabungkan dari katalog; log hanya membawa `raw_material_id`. */
function useRawMaterialNames(outletId: string) {
  const { data } = useRawMaterials(outletId)
  return React.useMemo(() => {
    const map = new Map<string, { name: string; unit: string }>()
    for (const material of data ?? []) map.set(material.id, { name: material.name, unit: material.unit })
    return map
  }, [data])
}

/* ── D-16 Laporan Restock ─────────────────────────────────────────────────── */

export function RestockReport() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Laporan Restock" description="Riwayat pembelian bahan baku." />
      <OutletGuard>{(outletId) => <RestockTable outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function RestockTable({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useRestockLogs(outletId)
  const names = useRawMaterialNames(outletId)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat laporan restock')
  }, [error])

  if (isPending) return <SkeletonTable />

  return (
    <div className="flex flex-col gap-4">
      <NoFilterBanner />

      {!data?.length ? (
        <EmptyState icon={FileBarChart} title="Belum ada riwayat restock" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Waktu</TH>
              <TH>Bahan baku</TH>
              <TH numeric>Jumlah</TH>
              <TH numeric>Harga/unit</TH>
              <TH numeric>Total</TH>
              <TH>Pemasok</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((log) => {
              const material = names.get(log.raw_material_id)
              return (
                <TR key={log.id}>
                  <TD className="text-fg-muted">{formatDateTimeId(log.created_at)}</TD>
                  <TD className="font-medium">{material?.name ?? '(bahan baku terhapus)'}</TD>
                  <TD numeric>
                    <Num>{formatQuantity(log.quantity)}</Num>{' '}
                    <span className="text-fg-muted">{material?.unit ?? ''}</span>
                  </TD>
                  <TD numeric>
                    <Money minor={log.cost_per_unit_minor} size="sm" tone="muted" />
                  </TD>
                  <TD numeric>
                    <Money minor={log.total_cost_minor} size="sm" />
                  </TD>
                  <TD className="text-fg-muted">{log.supplier_name || '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}

/* ── D-18 Laporan Waste ───────────────────────────────────────────────────── */

export function WasteReport() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Laporan Waste Bahan Baku"
        description="Pencatatan sisi Admin. Waste produk jadi dari kasir dilaporkan terpisah."
      />
      <OutletGuard>{(outletId) => <WasteTable outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function WasteTable({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useWasteLogs(outletId)
  const names = useRawMaterialNames(outletId)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat laporan waste')
  }, [error])

  if (isPending) return <SkeletonTable />

  return (
    <div className="flex flex-col gap-4">
      <NoFilterBanner />

      {!data?.length ? (
        <EmptyState icon={Trash2} title="Belum ada riwayat waste bahan baku" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Waktu</TH>
              <TH>Bahan baku</TH>
              <TH numeric>Jumlah</TH>
              <TH>Alasan</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((log) => {
              const material = names.get(log.raw_material_id)
              return (
                <TR key={log.id}>
                  <TD className="text-fg-muted">{formatDateTimeId(log.created_at)}</TD>
                  <TD className="font-medium">{material?.name ?? '(bahan baku terhapus)'}</TD>
                  <TD numeric>
                    <Num>{formatQuantity(log.quantity)}</Num>{' '}
                    <span className="text-fg-muted">{material?.unit ?? ''}</span>
                  </TD>
                  <TD>{log.reason}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}

/* ── D-20 Laporan Opname (dengan penyorotan fraud_flag) ───────────────────── */

export function OpnameReport() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Laporan Stock Opname"
        description="Hasil hitung fisik beserta selisihnya terhadap stok sistem."
      />
      <OutletGuard>{(outletId) => <OpnameTable outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function OpnameTable({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useOpnameLogs(outletId)
  const names = useRawMaterialNames(outletId)
  const [onlyFlagged, setOnlyFlagged] = React.useState(false)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat laporan opname')
  }, [error])

  const flaggedCount = data?.filter((log) => log.fraud_flag).length ?? 0
  const rows = onlyFlagged ? (data ?? []).filter((log) => log.fraud_flag) : (data ?? [])

  if (isPending) return <SkeletonTable />

  return (
    <div className="flex flex-col gap-4">
      <NoFilterBanner />

      {flaggedCount > 0 ? (
        <Banner tone="danger" icon={ShieldAlert} title={`${flaggedCount} opname ditandai mencurigakan`}>
          Backend menandai selisih lebih dari 5% terhadap stok sistem (ambang <em>hard-coded</em>).
          Tanda ini adalah indikator untuk ditelusuri, bukan tuduhan.
        </Banner>
      ) : null}

      {data?.length ? (
        <label className="flex items-center gap-2 text-pos-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--accent)]"
            checked={onlyFlagged}
            onChange={(e) => setOnlyFlagged(e.target.checked)}
          />
          Tampilkan hanya yang ditandai
        </label>
      ) : null}

      {!rows.length ? (
        <EmptyState
          icon={FileBarChart}
          title={onlyFlagged ? 'Tidak ada opname yang ditandai' : 'Belum ada riwayat opname'}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Waktu</TH>
              <TH>Bahan baku</TH>
              <TH numeric>Stok sistem</TH>
              <TH numeric>Hitung fisik</TH>
              <TH numeric>Selisih</TH>
              <TH numeric>Nilai selisih</TH>
              <TH>Status</TH>
              <TH>Catatan</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((log) => {
              const material = names.get(log.raw_material_id)
              const shortage = log.difference < 0

              return (
                <TR key={log.id} className={cn(log.fraud_flag && 'bg-danger-subtle')}>
                  <TD className="text-fg-muted">{formatDateTimeId(log.created_at)}</TD>
                  <TD className="font-medium">{material?.name ?? '(bahan baku terhapus)'}</TD>
                  <TD numeric>
                    <Num>{formatQuantity(log.system_stock)}</Num>
                  </TD>
                  <TD numeric>
                    <Num>{formatQuantity(log.actual_stock)}</Num>
                  </TD>
                  <TD numeric>
                    <Num className={cn('font-semibold', shortage ? 'text-danger' : 'text-success-text')}>
                      {log.difference > 0 ? '+' : ''}
                      {formatQuantity(log.difference)}
                    </Num>
                  </TD>
                  <TD numeric>
                    <Money
                      minor={log.difference_value_minor}
                      size="sm"
                      signed
                      tone={shortage ? 'danger' : 'success'}
                    />
                  </TD>
                  <TD>
                    {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]). */}
                    {log.fraud_flag ? (
                      <Badge tone="danger" icon={AlertTriangle}>
                        Ditandai
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Wajar</Badge>
                    )}
                  </TD>
                  <TD className="text-fg-muted">{log.notes || '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}

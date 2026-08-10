'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Input, NumericInput, Select } from '@/components/ui/input'
import { Num, formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCreateOpnameBulk } from '@/features/admin/inventory/hooks/useInventoryOps'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import type { OpnameInputType } from '@/lib/types/inventory'
import { cn } from '@/lib/utils/cn'

type Entry = { actual: string; inputType: OpnameInputType; notes: string }

const EMPTY_ENTRY: Entry = { actual: '', inputType: 'base_unit', notes: '' }

const num = (raw: string): number => {
  const value = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

/** D-19 Lembar Hitung Opname Massal — docs/04 §B.1. */
export function OpnameSheet() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Opname"
        description="Lembar hitung fisik. Hanya baris yang diisi yang dikirim."
      />
      <OutletGuard>{(outletId) => <OpnameInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function OpnameInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { data: materials, isPending } = useRawMaterials(outletId)
  const createOpname = useCreateOpnameBulk(outletId)
  const [entries, setEntries] = React.useState<Partial<Record<string, Entry>>>({})
  const [confirming, setConfirming] = React.useState(false)

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [id]: { ...EMPTY_ENTRY, ...prev[id], ...patch } }))

  /** Baris kosong sengaja dilewati: opname parsial adalah kasus normal. */
  const filled = (materials ?? []).filter((m) => (entries[m.id]?.actual ?? '').trim() !== '')

  const submit = async () => {
    try {
      await createOpname.mutateAsync(
        filled.map((m) => {
          const entry = entries[m.id] ?? EMPTY_ENTRY
          return {
            raw_material_id: m.id,
            input_type: entry.inputType,
            actual_stock: num(entry.actual),
            notes: entry.notes.trim() || undefined,
          }
        }),
      )
      toast.success(`${filled.length} opname dicatat`)
      router.replace('/admin/reports/opname')
    } catch (err) {
      toastApiError(err, 'Gagal mencatat opname')
    } finally {
      setConfirming(false)
    }
  }

  if (isPending) return <Skeleton className="h-96 w-full" />

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="warning" title="Opname menimpa stok dan tidak dapat dibatalkan">
        Stok sistem akan <strong>diganti</strong> dengan hasil hitung fisik Anda — bukan
        ditambah atau dikurangi. Tidak ada endpoint pembatalan opname. Selisih lebih dari 5% akan
        ditandai <code>fraud_flag</code> oleh backend.
      </Banner>

      <Table>
        <THead>
          <TR>
            <TH>Bahan baku</TH>
            <TH numeric>Stok sistem</TH>
            <TH>Satuan input</TH>
            <TH numeric>Hitung fisik</TH>
            <TH numeric>Selisih (base unit)</TH>
            <TH>Catatan</TH>
          </TR>
        </THead>
        <TBody>
          {(materials ?? []).map((material) => {
            const entry = entries[material.id] ?? EMPTY_ENTRY
            const packageAllowed =
              !!material.quantity_per_package && material.quantity_per_package > 0

            // Konversi mengikuti backend: actual_base = actual × quantity_per_package.
            const actualBase =
              entry.inputType === 'package_unit'
                ? num(entry.actual) * (material.quantity_per_package ?? 0)
                : num(entry.actual)

            const touched = entry.actual.trim() !== ''
            const difference = actualBase - material.stock

            return (
              <TR key={material.id}>
                <TD className="font-medium">{material.name}</TD>
                <TD numeric>
                  <Num>{formatQuantity(material.stock)}</Num>{' '}
                  <span className="text-fg-muted">{material.unit}</span>
                </TD>
                <TD>
                  <Select
                    aria-label={`Satuan input untuk ${material.name}`}
                    value={entry.inputType}
                    onChange={(e) =>
                      update(material.id, { inputType: e.target.value as OpnameInputType })
                    }
                  >
                    <option value="base_unit">{material.unit} (base)</option>
                    {/* Backend menolak package_unit tanpa quantity_per_package
                        yang valid — opsinya tidak ditawarkan sama sekali. */}
                    {packageAllowed ? (
                      <option value="package_unit">
                        {material.package_unit} (×{formatQuantity(material.quantity_per_package!)})
                      </option>
                    ) : null}
                  </Select>
                </TD>
                <TD numeric>
                  <NumericInput
                    inputMode="decimal"
                    aria-label={`Hitung fisik ${material.name}`}
                    value={entry.actual}
                    onChange={(e) => update(material.id, { actual: e.target.value })}
                  />
                </TD>
                <TD numeric>
                  {touched ? (
                    <Num
                      className={cn(
                        'font-semibold',
                        difference < 0 ? 'text-danger' : difference > 0 ? 'text-success-text' : '',
                      )}
                    >
                      {difference > 0 ? '+' : ''}
                      {formatQuantity(difference)}
                    </Num>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </TD>
                <TD>
                  <Input
                    aria-label={`Catatan ${material.name}`}
                    value={entry.notes}
                    onChange={(e) => update(material.id, { notes: e.target.value })}
                  />
                </TD>
              </TR>
            )
          })}
        </TBody>
      </Table>

      <div className="flex items-center justify-between">
        <Button variant="neutral" onClick={() => router.back()}>
          Batal
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!filled.length || createOpname.isPending}
          onClick={() => setConfirming(true)}
        >
          Catat {filled.length || ''} Opname
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        pending={createOpname.isPending}
        confirmLabel="Ya, timpa stok"
        title={`Timpa stok ${filled.length} bahan baku?`}
        description="Stok sistem akan diganti dengan angka hitung fisik Anda. Operasi ini destruktif dan tidak dapat dibatalkan lewat aplikasi maupun API."
      />
    </div>
  )
}

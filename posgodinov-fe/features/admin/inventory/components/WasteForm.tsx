'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Input, NumericInput, Select } from '@/components/ui/input'
import { Num, formatQuantity } from '@/components/ui/money'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCreateWasteBulk } from '@/features/admin/inventory/hooks/useInventoryOps'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'

type Row = {
  key: string
  raw_material_id: string
  unit_type: 'package' | 'unit'
  quantity: string
  reason: string
}

const newRow = (): Row => ({
  key: `w-${Math.random().toString(36).slice(2)}`,
  raw_material_id: '',
  unit_type: 'package',
  quantity: '',
  reason: '',
})

const num = (raw: string): number => {
  const value = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

/** D-17 Form Waste Bahan Baku — docs/04 §B.1. */
export function WasteForm() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Waste Bahan Baku"
        description="Pencatatan bahan baku yang terbuang, rusak, atau kedaluwarsa."
      />
      <OutletGuard>{(outletId) => <WasteInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function WasteInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { data: materials, isPending } = useRawMaterials(outletId)
  const createWaste = useCreateWasteBulk(outletId)
  const [rows, setRows] = React.useState<Row[]>([newRow()])
  const [error, setError] = React.useState<string | null>(null)

  const byId = React.useMemo(
    () => new Map((materials ?? []).map((m) => [m.id, m])),
    [materials],
  )

  const filled = rows.filter((r) => r.raw_material_id)

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!filled.length) {
      setError('Pilih minimal satu bahan baku.')
      return
    }

    const hasInvalidQty = filled.some((r) => {
      const material = byId.get(r.raw_material_id)
      const qpp =
        material?.quantity_per_package && material.quantity_per_package > 0
          ? material.quantity_per_package
          : 1
      const isPkg = r.unit_type === 'package' && Boolean(material?.package_unit && qpp > 0)
      const baseQty = isPkg ? num(r.quantity) * qpp : num(r.quantity)
      return baseQty <= 0
    })

    if (hasInvalidQty) {
      setError('Kuantitas waste harus lebih dari 0.')
      return
    }

    const hasExceedingStock = filled.some((r) => {
      const material = byId.get(r.raw_material_id)
      if (!material) return false
      const qpp =
        material.quantity_per_package && material.quantity_per_package > 0
          ? material.quantity_per_package
          : 1
      const isPkg = r.unit_type === 'package' && Boolean(material.package_unit && qpp > 0)
      const baseQty = isPkg ? num(r.quantity) * qpp : num(r.quantity)
      return baseQty > material.stock
    })

    if (hasExceedingStock) {
      setError('Kuantitas waste melebihi stok yang tersedia.')
      return
    }

    if (filled.some((r) => !r.reason.trim())) {
      setError('Alasan wajib diisi untuk setiap baris bahan baku.')
      return
    }
    setError(null)

    try {
      await createWaste.mutateAsync(
        filled.map((row) => {
          const material = byId.get(row.raw_material_id)
          const qpp =
            material?.quantity_per_package && material.quantity_per_package > 0
              ? material.quantity_per_package
              : 1
          const isPkg = row.unit_type === 'package' && Boolean(material?.package_unit && qpp > 0)
          const baseQuantity = isPkg ? num(row.quantity) * qpp : num(row.quantity)

          return {
            raw_material_id: row.raw_material_id,
            quantity: baseQuantity,
            reason: row.reason.trim(),
          }
        }),
      )
      toast.success(`${filled.length} waste dicatat`)
      router.replace('/admin/reports/waste')
    } catch (err) {
      toastApiError(err, 'Gagal mencatat waste')
    }
  }

  if (isPending) return <Skeleton className="h-96 w-full" />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Banner tone="warning" title="Stok harus mencukupi">
        Berbeda dengan waste produk jadi dari kasir yang membolehkan stok minus,{' '}
        <strong>waste bahan baku di sini ditolak bila stok tidak mencukupi</strong>. Perbedaan ini
        disengaja: pencatatan Admin bersifat administratif, sedangkan transaksi kasir sudah
        benar-benar terjadi.
      </Banner>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Daftar waste</CardTitle>
          <Button variant="neutral" size="sm" onClick={() => setRows((p) => [...p, newRow()])}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Baris
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="hidden lg:grid lg:grid-cols-[1.2fr_6.5rem_7rem_7.5rem_1fr_2.5rem] items-center gap-2 px-1 pb-2 text-pos-xs font-semibold text-fg-muted border-b border-border">
            <span>Bahan Baku</span>
            <span>Jumlah</span>
            <span>Satuan</span>
            <span>Sisa Stok</span>
            <span>Alasan</span>
            <span></span>
          </div>

          {rows.map((row) => {
            const material = byId.get(row.raw_material_id)
            const hasPkg = Boolean(
              material?.package_unit &&
                material?.quantity_per_package &&
                material.quantity_per_package > 0,
            )
            const qpp = hasPkg ? material!.quantity_per_package! : 1
            const isPkg = row.unit_type === 'package' && hasPkg
            const baseQuantity = isPkg ? num(row.quantity) * qpp : num(row.quantity)
            const availableStock = material ? material.stock : 0
            const exceedsStock = !!material && baseQuantity > availableStock

            return (
              <div
                key={row.key}
                className="grid grid-cols-2 items-start gap-2 rounded-lg border border-border p-3 lg:grid-cols-[1.2fr_6.5rem_7rem_7.5rem_1fr_2.5rem] lg:border-0 lg:p-0"
              >
                <div className="col-span-2 lg:col-span-1">
                  <Select
                    value={row.raw_material_id}
                    aria-label="Bahan baku"
                    onChange={(e) => {
                      const next = byId.get(e.target.value)
                      const nextHasPkg = Boolean(
                        next?.package_unit &&
                          next?.quantity_per_package &&
                          next.quantity_per_package > 0,
                      )
                      update(row.key, {
                        raw_material_id: e.target.value,
                        unit_type: nextHasPkg ? 'package' : 'unit',
                        quantity: '',
                      })
                    }}
                  >
                    <option value="">Pilih bahan baku…</option>
                    {(materials ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="col-span-1 flex flex-col gap-1">
                  <NumericInput
                    inputMode="decimal"
                    aria-label="Jumlah terbuang"
                    placeholder="Jumlah"
                    invalid={exceedsStock}
                    value={row.quantity}
                    onChange={(e) => update(row.key, { quantity: e.target.value })}
                  />
                  {isPkg && num(row.quantity) > 0 ? (
                    <span className="text-pos-xs text-fg-muted font-medium">
                      = {(num(row.quantity) * qpp).toLocaleString('id-ID')} {material?.unit}
                    </span>
                  ) : null}
                  {exceedsStock ? (
                    <span className="text-pos-xs text-danger">⚠ Melebihi stok</span>
                  ) : null}
                </div>

                <div className="col-span-1 flex h-touch items-center">
                  {hasPkg ? (
                    <Select
                      value={row.unit_type}
                      aria-label="Pilih satuan atau kemasan"
                      onChange={(e) => {
                        const nextType = e.target.value as 'package' | 'unit'
                        if (nextType === row.unit_type) return

                        let newQty = row.quantity
                        if (nextType === 'unit') {
                          if (row.quantity) {
                            newQty = (num(row.quantity) * qpp).toString()
                          }
                        } else {
                          if (row.quantity) {
                            newQty = (num(row.quantity) / qpp).toString()
                          }
                        }

                        update(row.key, {
                          unit_type: nextType,
                          quantity: newQty,
                        })
                      }}
                    >
                      <option value="package">{material?.package_unit}</option>
                      <option value="unit">{material?.unit}</option>
                    </Select>
                  ) : (
                    <span className="text-pos-sm text-fg-muted px-2">
                      {material?.unit ?? '—'}
                    </span>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-1 flex h-touch flex-col justify-center">
                  {material ? (
                    isPkg ? (
                      <>
                        <span className="text-pos-sm text-fg font-medium">
                          <Num>{formatQuantity(availableStock / qpp)}</Num> {material.package_unit}
                        </span>
                        <span className="text-pos-xs text-fg-subtle">
                          ({formatQuantity(availableStock)} {material.unit})
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-pos-sm text-fg font-medium">
                          <Num>{formatQuantity(availableStock)}</Num> {material.unit}
                        </span>
                        {hasPkg ? (
                          <span className="text-pos-xs text-fg-subtle">
                            (≈ {formatQuantity(availableStock / qpp)} {material.package_unit})
                          </span>
                        ) : null}
                      </>
                    )
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                  <Input
                    aria-label="Alasan"
                    placeholder="Alasan (wajib)"
                    value={row.reason}
                    onChange={(e) => update(row.key, { reason: e.target.value })}
                  />
                </div>

                <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex h-touch items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    aria-label="Hapus baris"
                    onClick={() => setRows((p) => p.filter((r) => r.key !== row.key))}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-pos-sm text-danger">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="neutral" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" variant="danger" size="lg" disabled={createWaste.isPending}>
          {createWaste.isPending ? 'Menyimpan…' : 'Catat Waste'}
        </Button>
      </div>
    </form>
  )
}

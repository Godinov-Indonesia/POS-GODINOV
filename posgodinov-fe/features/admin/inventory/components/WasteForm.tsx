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

type Row = { key: string; raw_material_id: string; quantity: string; reason: string }

const newRow = (): Row => ({
  key: `w-${Math.random().toString(36).slice(2)}`,
  raw_material_id: '',
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
    if (filled.some((r) => num(r.quantity) <= 0)) {
      setError('Kuantitas waste harus lebih dari 0.')
      return
    }
    if (filled.some((r) => !r.reason.trim())) {
      setError('Alasan wajib diisi untuk setiap baris — backend menolak yang kosong.')
      return
    }
    setError(null)

    try {
      await createWaste.mutateAsync(
        filled.map((row) => ({
          raw_material_id: row.raw_material_id,
          quantity: num(row.quantity),
          reason: row.reason.trim(),
        })),
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

        <CardContent className="flex flex-col gap-2">
          {rows.map((row) => {
            const material = byId.get(row.raw_material_id)
            const exceedsStock = !!material && num(row.quantity) > material.stock

            return (
              <div
                key={row.key}
                className="grid grid-cols-2 items-start gap-2 rounded-lg border border-border p-2 lg:grid-cols-[1fr_7rem_7rem_1fr_3rem] lg:border-0 lg:p-0"
              >
                <div className="col-span-2 lg:col-span-1">
                  <Select
                    value={row.raw_material_id}
                    aria-label="Bahan baku"
                    onChange={(e) => update(row.key, { raw_material_id: e.target.value })}
                  >
                    <option value="">Pilih bahan baku…</option>
                    {(materials ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <NumericInput
                    inputMode="decimal"
                    aria-label="Jumlah terbuang"
                    placeholder="Jumlah"
                    invalid={exceedsStock}
                    value={row.quantity}
                    onChange={(e) => update(row.key, { quantity: e.target.value })}
                  />
                  {exceedsStock ? (
                    <span className="text-pos-xs text-danger">⚠ Melebihi stok</span>
                  ) : null}
                </div>

                <span className="text-pos-sm text-fg-muted">
                  {material ? (
                    <>
                      <Num>{formatQuantity(material.stock)}</Num> {material.unit}
                    </>
                  ) : (
                    '—'
                  )}
                </span>

                <Input
                  aria-label="Alasan"
                  placeholder="Alasan (wajib)"
                  value={row.reason}
                  onChange={(e) => update(row.key, { reason: e.target.value })}
                />

                <div className="flex justify-end">
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

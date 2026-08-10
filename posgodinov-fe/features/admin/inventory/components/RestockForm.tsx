'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Input, NumericInput, Select } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCreateRestockBulk } from '@/features/admin/inventory/hooks/useInventoryOps'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { toMajor, toMinor } from '@/lib/money'

type Row = {
  key: string
  raw_material_id: string
  quantity: string
  cost_per_unit: string
  supplier_name: string
}

const newRow = (): Row => ({
  key: `r-${Math.random().toString(36).slice(2)}`,
  raw_material_id: '',
  quantity: '',
  cost_per_unit: '',
  supplier_name: '',
})

const num = (raw: string): number => {
  const value = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

/** D-15 Form Restock — satuan & massal ([04 §B.1]). */
export function RestockForm() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Restock Bahan Baku"
        description="Pembelian bahan baku. Menambah stok dan menghitung ulang HPP."
      />
      <OutletGuard>{(outletId) => <RestockInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function RestockInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { data: materials, isPending } = useRawMaterials(outletId)
  const createRestock = useCreateRestockBulk(outletId)
  const [rows, setRows] = React.useState<Row[]>([newRow()])
  const [error, setError] = React.useState<string | null>(null)

  const byId = React.useMemo(
    () => new Map((materials ?? []).map((m) => [m.id, m])),
    [materials],
  )

  const filled = rows.filter((r) => r.raw_material_id)
  const totalMinor = filled.reduce(
    (sum, row) => sum + Math.round(num(row.quantity) * toMinor(num(row.cost_per_unit))),
    0,
  )

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!filled.length) {
      setError('Pilih minimal satu bahan baku.')
      return
    }
    if (filled.some((r) => num(r.quantity) <= 0)) {
      setError('Kuantitas restock harus lebih dari 0.')
      return
    }
    if (filled.some((r) => num(r.cost_per_unit) < 0)) {
      setError('Harga beli per unit tidak boleh negatif.')
      return
    }
    setError(null)

    try {
      await createRestock.mutateAsync(
        filled.map((row) => ({
          raw_material_id: row.raw_material_id,
          quantity: num(row.quantity),
          cost_per_unit_minor: toMinor(num(row.cost_per_unit)),
          supplier_name: row.supplier_name.trim() || undefined,
        })),
      )
      toast.success(`${filled.length} restock dicatat`)
      router.replace('/admin/reports/restock')
    } catch (err) {
      toastApiError(err, 'Gagal mencatat restock')
    }
  }

  if (isPending) return <Skeleton className="h-96 w-full" />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Banner tone="info" title="HPP dihitung ulang otomatis">
        Restock memakai <em>moving average</em>:{' '}
        <code>(stok_lama × HPP_lama + qty × harga_beli) ÷ (stok_lama + qty)</code>. HPP produk yang
        memakai bahan ini ikut berubah.
      </Banner>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Daftar pembelian</CardTitle>
          <Button variant="neutral" size="sm" onClick={() => setRows((p) => [...p, newRow()])}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Baris
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          {rows.map((row) => {
            const material = byId.get(row.raw_material_id)
            const subtotal = Math.round(num(row.quantity) * toMinor(num(row.cost_per_unit)))

            return (
              <div
                key={row.key}
                className="grid grid-cols-2 items-center gap-2 rounded-lg border border-border p-2 lg:grid-cols-[1fr_7rem_4rem_8rem_1fr_7rem_3rem] lg:border-0 lg:p-0"
              >
                <div className="col-span-2 lg:col-span-1">
                  <Select
                    value={row.raw_material_id}
                    aria-label="Bahan baku"
                    onChange={(e) => {
                      const next = byId.get(e.target.value)
                      update(row.key, {
                        raw_material_id: e.target.value,
                        // Prasi harga beli terakhir yang diketahui, tetap dapat diubah.
                        cost_per_unit: next ? toMajor(next.cost_per_unit_minor).toString() : '',
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

                <NumericInput
                  inputMode="decimal"
                  aria-label="Jumlah masuk"
                  placeholder="Jumlah"
                  value={row.quantity}
                  onChange={(e) => update(row.key, { quantity: e.target.value })}
                />

                <span className="text-pos-sm text-fg-muted">{material?.unit ?? '—'}</span>

                <NumericInput
                  inputMode="decimal"
                  aria-label="Harga beli per unit"
                  placeholder="Harga/unit"
                  value={row.cost_per_unit}
                  onChange={(e) => update(row.key, { cost_per_unit: e.target.value })}
                />

                <Input
                  aria-label="Nama pemasok"
                  placeholder="Pemasok (opsional)"
                  value={row.supplier_name}
                  onChange={(e) => update(row.key, { supplier_name: e.target.value })}
                />

                <span className="text-right">
                  {material ? <Money minor={subtotal} size="sm" /> : <span className="text-fg-subtle">—</span>}
                </span>

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

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-muted p-3">
        <span className="text-pos-sm text-fg-muted">Total pembelian</span>
        <Money minor={totalMinor} size="xl" />
      </div>

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
        <Button type="submit" variant="primary" size="lg" disabled={createRestock.isPending}>
          {createRestock.isPending ? 'Menyimpan…' : 'Catat Restock'}
        </Button>
      </div>
    </form>
  )
}

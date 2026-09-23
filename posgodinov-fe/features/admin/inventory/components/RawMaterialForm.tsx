'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, NumericInput } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import {
  useCreateRawMaterial,
  useRawMaterials,
  useUpdateRawMaterial,
} from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { toMajor, toMinor } from '@/lib/money'
import type { RawMaterialView } from '@/lib/types/domain'

type FormState = {
  name: string
  unit: string
  package_unit: string
  quantity_per_package: string
  stock: string
  cost_per_unit: string
}

const EMPTY: FormState = {
  name: '',
  unit: '',
  package_unit: '',
  quantity_per_package: '',
  stock: '',
  cost_per_unit: '',
}

const parseNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

/** D-14 — mode tambah. */
export function RawMaterialCreateForm() {
  return (
    <OutletGuard>{(outletId) => <CreateInner outletId={outletId} />}</OutletGuard>
  )
}

function CreateInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const createRawMaterial = useCreateRawMaterial(outletId)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.unit.trim()) {
      setError('Nama dan base unit wajib diisi.')
      return
    }
    setError(null)

    try {
      const costMajor = parseNumber(form.cost_per_unit)
      await createRawMaterial.mutateAsync({
        name: form.name.trim(),
        unit: form.unit.trim(),
        package_unit: form.package_unit.trim() || undefined,
        quantity_per_package: parseNumber(form.quantity_per_package),
        stock: parseNumber(form.stock),
        // Input diisi dalam Rupiah; state internal & API layer bekerja dalam sen.
        cost_per_unit_minor: costMajor === undefined ? undefined : toMinor(costMajor),
      })
      toast.success('Bahan baku ditambahkan')
      router.replace('/admin/inventory')
    } catch (err) {
      toastApiError(err, 'Gagal menambahkan bahan baku')
    }
  }

  return (
    <FormShell
      title="Tambah Bahan Baku"
      form={form}
      setForm={setForm}
      error={error}
      pending={createRawMaterial.isPending}
      showStock
      onSubmit={submit}
      onCancel={() => router.back()}
    />
  )
}

/** D-14 — mode ubah. ⚠️ **Tanpa** field stok ([03 §7.4]). */
export function RawMaterialEditForm({ rawMaterialId }: { rawMaterialId: string }) {
  return (
    <OutletGuard>
      {(outletId) => <EditInner outletId={outletId} rawMaterialId={rawMaterialId} />}
    </OutletGuard>
  )
}

function EditInner({ outletId, rawMaterialId }: { outletId: string; rawMaterialId: string }) {
  const { data, isPending } = useRawMaterials(outletId)
  const material = data?.find((m) => m.id === rawMaterialId)

  if (isPending) return <Skeleton className="h-96 w-full max-w-2xl" />
  if (!material) return <Banner tone="danger">Bahan baku tidak ditemukan atau sudah dihapus.</Banner>

  // `key` memaksa remount bila baris berganti, sehingga state form selalu
  // diinisialisasi dari data yang sudah ada — bukan ditambal lewat efek.
  return <EditFormLoaded key={material.id} outletId={outletId} material={material} />
}

function EditFormLoaded({
  outletId,
  material,
}: {
  outletId: string
  material: RawMaterialView
}) {
  const router = useRouter()
  const updateRawMaterial = useUpdateRawMaterial(outletId)

  const [form, setForm] = React.useState<FormState>(() => ({
    name: material.name,
    unit: material.unit,
    package_unit: material.package_unit ?? '',
    quantity_per_package: material.quantity_per_package?.toString() ?? '',
    stock: '',
    cost_per_unit: toMajor(material.cost_per_unit_minor).toString(),
  }))
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.unit.trim()) {
      setError('Nama dan base unit wajib diisi.')
      return
    }
    setError(null)

    try {
      const costMajor = parseNumber(form.cost_per_unit)
      await updateRawMaterial.mutateAsync({
        id: material.id,
        input: {
          name: form.name.trim(),
          unit: form.unit.trim(),
          package_unit: form.package_unit.trim() || undefined,
          quantity_per_package: parseNumber(form.quantity_per_package),
          cost_per_unit_minor: costMajor === undefined ? undefined : toMinor(costMajor),
        },
      })
      toast.success('Bahan baku diperbarui')
      router.replace('/admin/inventory')
    } catch (err) {
      toastApiError(err, 'Gagal memperbarui bahan baku')
    }
  }

  return (
    <FormShell
      title={`Ubah — ${material.name}`}
      form={form}
      setForm={setForm}
      error={error}
      pending={updateRawMaterial.isPending}
      showStock={false}
      onSubmit={submit}
      onCancel={() => router.back()}
    />
  )
}

function FormShell({
  title,
  form,
  setForm,
  error,
  pending,
  showStock,
  onSubmit,
  onCancel,
}: {
  title: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  error: string | null
  pending: boolean
  showStock: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={title} />

      {showStock ? null : (
        <Banner tone="info" title="Stok tidak dapat diubah di sini">
          Ini desain yang disengaja: stok hanya berubah melalui restock, waste, opname, atau
          sinkronisasi POS. Untuk mengoreksi angka stok, gunakan <strong>Stock Opname</strong>.
        </Banner>
      )}

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Nama" htmlFor="name" required>
              <Input id="name" value={form.name} onChange={set('name')} autoFocus />
            </Field>

            <Field
              label="Base unit"
              htmlFor="unit"
              required
              hint="Satuan terkecil yang dipakai stok dan resep, mis. gram, ml, pcs."
            >
              <Input id="unit" value={form.unit} onChange={set('unit')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Satuan kemasan"
                htmlFor="package_unit"
                hint="Opsional, mis. kotak, kaleng, dus."
              >
                <Input id="package_unit" value={form.package_unit} onChange={set('package_unit')} />
              </Field>

              <Field
                label="Isi per kemasan"
                htmlFor="quantity_per_package"
                hint="Wajib bila ingin opname memakai satuan kemasan."
              >
                <NumericInput
                  id="quantity_per_package"
                  inputMode="decimal"
                  value={form.quantity_per_package}
                  onChange={set('quantity_per_package')}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {showStock ? (
                <Field label="Stok awal" htmlFor="stock" hint="Dalam base unit. Default 0.">
                  <NumericInput
                    id="stock"
                    inputMode="decimal"
                    value={form.stock}
                    onChange={set('stock')}
                  />
                </Field>
              ) : null}

              <Field
                label="HPP per base unit (Rp)"
                htmlFor="cost_per_unit"
                hint="Dihitung ulang otomatis sebagai moving average setiap restock."
              >
                <NumericInput
                  id="cost_per_unit"
                  inputMode="decimal"
                  value={form.cost_per_unit}
                  onChange={set('cost_per_unit')}
                />
              </Field>
            </div>

            {error ? (
              <p role="alert" className="flex items-center gap-1 text-pos-sm text-danger">
                <span aria-hidden="true">⚠</span>
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Menyimpan…' : 'Simpan'}
              </Button>
              <Button variant="neutral" onClick={onCancel}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

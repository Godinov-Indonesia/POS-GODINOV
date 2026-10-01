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
import { cn } from '@/lib/utils/cn'

type FormState = {
  name: string
  sku: string
  unit: string
  package_unit: string
  quantity_per_package: string
  stock_input_mode: 'package' | 'unit'
  package_stock: string
  loose_stock: string
  unit_stock_input: string
  cost_per_unit: string
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  unit: '',
  package_unit: '',
  quantity_per_package: '',
  stock_input_mode: 'package',
  package_stock: '',
  loose_stock: '',
  unit_stock_input: '',
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
      const qpp = parseNumber(form.quantity_per_package)
      let pkgStock = 0
      let looseStock = 0

      if (form.stock_input_mode === 'package') {
        pkgStock = Math.floor(parseNumber(form.package_stock) ?? 0)
        looseStock = parseNumber(form.loose_stock) ?? 0
      } else {
        const totalUnit = parseNumber(form.unit_stock_input) ?? 0
        if (form.package_unit.trim() && qpp && qpp > 0) {
          pkgStock = Math.floor(totalUnit / qpp)
          looseStock = Math.round((totalUnit - pkgStock * qpp) * 10000) / 10000
        } else {
          pkgStock = 0
          looseStock = totalUnit
        }
      }

      await createRawMaterial.mutateAsync({
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        unit: form.unit.trim(),
        package_unit: form.package_unit.trim() || undefined,
        quantity_per_package: qpp,
        package_stock: pkgStock,
        loose_stock: looseStock,
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
    sku: material.sku ?? '',
    unit: material.unit,
    package_unit: material.package_unit ?? '',
    quantity_per_package: material.quantity_per_package?.toString() ?? '',
    stock_input_mode: 'package',
    package_stock: '',
    loose_stock: '',
    unit_stock_input: '',
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
          sku: form.sku.trim() || undefined,
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

  const switchStockMode = (mode: 'package' | 'unit') => {
    if (mode === form.stock_input_mode) return
    const qpp = parseNumber(form.quantity_per_package) ?? 0
    if (mode === 'unit') {
      const pkg = Math.floor(parseNumber(form.package_stock) ?? 0)
      const loose = parseNumber(form.loose_stock) ?? 0
      const totalUnit = pkg * qpp + loose
      setForm((prev) => ({
        ...prev,
        stock_input_mode: 'unit',
        unit_stock_input: totalUnit > 0 ? totalUnit.toString() : prev.unit_stock_input,
      }))
    } else {
      const totalUnit = parseNumber(form.unit_stock_input) ?? 0
      if (qpp > 0) {
        const pkg = Math.floor(totalUnit / qpp)
        const loose = Math.round((totalUnit - pkg * qpp) * 10000) / 10000
        setForm((prev) => ({
          ...prev,
          stock_input_mode: 'package',
          package_stock: pkg > 0 ? pkg.toString() : prev.package_stock,
          loose_stock: loose > 0 ? loose.toString() : prev.loose_stock,
        }))
      } else {
        setForm((prev) => ({ ...prev, stock_input_mode: 'package' }))
      }
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={title} />

      {showStock ? null : (
        <Banner tone="info" title="Stok tidak dapat diubah langsung di sini">
          Stok tercatat secara otomatis melalui aktivitas restock, waste/pembuangan, penjualan, atau
          stock opname. Untuk memperbarui saldo stok fisik, gunakan menu <strong>Stock Opname</strong>.
        </Banner>
      )}

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Nama" htmlFor="name" required>
              <Input id="name" value={form.name} onChange={set('name')} autoFocus />
            </Field>

            <Field label="SKU / Kode Bahan" htmlFor="sku" hint="Opsional.">
              <Input id="sku" value={form.sku} onChange={set('sku')} placeholder="Contoh: RM-001" />
            </Field>

            <Field
              label="Satuan Dasar"
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

            {showStock ? (
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-subtle p-3.5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-pos-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Stok Awal
                    </p>
                    <span className="text-pos-xs text-fg-subtle">
                      Pilih metode input stok
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1">
                    <button
                      type="button"
                      onClick={() => switchStockMode('package')}
                      className={cn(
                        'flex items-center justify-center rounded-md px-3 py-1.5 text-pos-xs font-medium transition-colors',
                        form.stock_input_mode === 'package'
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
                      )}
                    >
                      Berdasarkan Kemasan {form.package_unit ? `(${form.package_unit})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchStockMode('unit')}
                      className={cn(
                        'flex items-center justify-center rounded-md px-3 py-1.5 text-pos-xs font-medium transition-colors',
                        form.stock_input_mode === 'unit'
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
                      )}
                    >
                      Berdasarkan Satuan Dasar {form.unit ? `(${form.unit})` : ''}
                    </button>
                  </div>
                </div>

                {form.stock_input_mode === 'package' ? (
                  form.package_unit && parseNumber(form.quantity_per_package) && (parseNumber(form.quantity_per_package)! > 0) ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label={`Stok Kemasan (${form.package_unit})`}
                          htmlFor="package_stock"
                          hint="Jumlah kemasan utuh (bilangan bulat)."
                        >
                          <NumericInput
                            id="package_stock"
                            inputMode="numeric"
                            value={form.package_stock}
                            onChange={set('package_stock')}
                            placeholder="0"
                          />
                        </Field>

                        <Field
                          label={`Stok Eceran (${form.unit || 'unit'})`}
                          htmlFor="loose_stock"
                          hint="Bahan eceran terbuka (opsional)."
                        >
                          <NumericInput
                            id="loose_stock"
                            inputMode="decimal"
                            value={form.loose_stock}
                            onChange={set('loose_stock')}
                            placeholder="0"
                          />
                        </Field>
                      </div>

                      {/* Kalkulasi otomatis ke satuan dasar */}
                      <div className="rounded-md border border-accent/20 bg-accent-subtle/50 p-3 text-pos-sm">
                        <p className="text-pos-xs text-fg-muted">
                          Kalkulasi ke satuan dasar ({form.unit || 'unit'}):
                        </p>
                        <div className="mt-1 flex flex-wrap items-baseline gap-2">
                          <strong className="font-mono text-pos-base font-bold text-accent">
                            {(
                              Math.floor(parseNumber(form.package_stock) ?? 0) *
                                (parseNumber(form.quantity_per_package) ?? 0) +
                              (parseNumber(form.loose_stock) ?? 0)
                            ).toLocaleString('id-ID')}{' '}
                            {form.unit || 'unit'}
                          </strong>
                          <span className="text-pos-xs text-fg-subtle">
                            ({Math.floor(parseNumber(form.package_stock) ?? 0)} {form.package_unit} ×{' '}
                            {(parseNumber(form.quantity_per_package) ?? 0).toLocaleString('id-ID')} {form.unit || 'unit'}
                            {(parseNumber(form.loose_stock) ?? 0) > 0
                              ? ` + ${(parseNumber(form.loose_stock) ?? 0).toLocaleString('id-ID')} ${form.unit || 'unit'} eceran`
                              : ''})
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Banner tone="info">
                      Untuk mengisi stok dalam <strong>satuan kemasan</strong>, silakan isi kolom <strong>Satuan kemasan</strong> dan <strong>Isi per kemasan</strong> di atas terlebih dahulu.
                    </Banner>
                  )
                ) : (
                  <div className="flex flex-col gap-3">
                    <Field
                      label={`Jumlah Stok Satuan Dasar (${form.unit || 'unit'})`}
                      htmlFor="unit_stock_input"
                      hint="Total kuantitas stok dalam satuan dasar terkecil."
                    >
                      <NumericInput
                        id="unit_stock_input"
                        inputMode="decimal"
                        value={form.unit_stock_input}
                        onChange={set('unit_stock_input')}
                        placeholder="0"
                      />
                    </Field>

                    {form.package_unit && parseNumber(form.quantity_per_package) && (parseNumber(form.quantity_per_package)! > 0) && parseNumber(form.unit_stock_input) ? (
                      <div className="rounded-md border border-border bg-surface p-3 text-pos-xs text-fg-muted">
                        Kalkulasi kemasan setara:{' '}
                        <strong className="font-semibold text-fg">
                          {Math.floor((parseNumber(form.unit_stock_input) ?? 0) / (parseNumber(form.quantity_per_package) || 1))}{' '}
                          {form.package_unit}
                        </strong>
                        {((parseNumber(form.unit_stock_input) ?? 0) % (parseNumber(form.quantity_per_package) || 1)) > 0 ? (
                          <span>
                            {' '}dan sisa{' '}
                            <strong className="font-semibold text-fg">
                              {((parseNumber(form.unit_stock_input) ?? 0) % (parseNumber(form.quantity_per_package) || 1)).toLocaleString('id-ID')}{' '}
                              {form.unit || 'unit'}
                            </strong>{' '}
                            eceran
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
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

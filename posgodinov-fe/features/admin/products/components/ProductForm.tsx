'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, NumericInput, Select } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCategories } from '@/features/admin/categories/hooks/useCategories'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import {
  BomBuilder,
  newBomRow,
  parseQuantity,
  type BomRow,
} from '@/features/admin/products/components/BomBuilder'
import { HppSummary } from '@/features/admin/products/components/HppSummary'
import { useCreateProduct, useProducts, useUpdateProduct } from '@/features/admin/products/hooks/useProducts'
import { findDuplicateRawMaterialIds } from '@/features/admin/products/lib/hpp'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { toMajor, toMinor } from '@/lib/money'
import type { ProductView, RawMaterialView } from '@/lib/types/domain'

type Values = {
  name: string
  price: string
  image_url: string
  category_id: string
  rows: BomRow[]
}

/** D-11 — mode tambah. */
export function ProductCreateForm() {
  return <OutletGuard>{(outletId) => <CreateInner outletId={outletId} />}</OutletGuard>
}

function CreateInner({ outletId }: { outletId: string }) {
  const createProduct = useCreateProduct(outletId)
  return (
    <ProductFormShell
      outletId={outletId}
      title="Tambah Produk"
      initial={{ name: '', price: '', image_url: '', category_id: '', rows: [newBomRow()] }}
      pending={createProduct.isPending}
      onSubmit={(input) => createProduct.mutateAsync(input)}
    />
  )
}

/** D-11 — mode ubah. */
export function ProductEditForm({ productId }: { productId: string }) {
  return (
    <OutletGuard>{(outletId) => <EditInner outletId={outletId} productId={productId} />}</OutletGuard>
  )
}

function EditInner({ outletId, productId }: { outletId: string; productId: string }) {
  const { data, isPending } = useProducts(outletId)
  const product = data?.find((p) => p.id === productId)

  if (isPending) return <Skeleton className="h-[70vh] w-full" />
  if (!product) return <Banner tone="danger">Produk tidak ditemukan atau sudah dihapus.</Banner>

  return <EditLoaded key={product.id} outletId={outletId} product={product} />
}

function EditLoaded({ outletId, product }: { outletId: string; product: ProductView }) {
  const updateProduct = useUpdateProduct(outletId)

  return (
    <ProductFormShell
      outletId={outletId}
      title={`Ubah Produk — ${product.name}`}
      editing
      initial={{
        name: product.name,
        price: toMajor(product.price_minor).toString(),
        image_url: product.image_url ?? '',
        category_id: product.category_id ?? '',
        rows: product.recipes.length
          ? product.recipes.map((r) => ({
              key: r.id,
              raw_material_id: r.raw_material_id,
              quantity: r.quantity.toString(),
            }))
          : [newBomRow()],
      }}
      pending={updateProduct.isPending}
      onSubmit={(input) => updateProduct.mutateAsync({ id: product.id, input })}
    />
  )
}

function ProductFormShell({
  outletId,
  title,
  initial,
  editing,
  pending,
  onSubmit,
}: {
  outletId: string
  title: string
  initial: Values
  editing?: boolean
  pending: boolean
  onSubmit: (input: {
    name: string
    price_minor: number
    image_url?: string
    category_id: string | null
    recipes: { raw_material_id: string; quantity: number }[]
  }) => Promise<unknown>
}) {
  const router = useRouter()
  const { data: categories } = useCategories(outletId)
  const { data: rawMaterials } = useRawMaterials(outletId)

  const [values, setValues] = React.useState<Values>(initial)
  const [error, setError] = React.useState<string | null>(null)

  // Identitas array harus stabil: `rawMaterials ?? []` membuat array baru pada
  // setiap render dan membatalkan seluruh useMemo di bawahnya.
  const materials: RawMaterialView[] = React.useMemo(() => rawMaterials ?? [], [rawMaterials])
  const byId = React.useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  const priceMinor = React.useMemo(() => {
    const value = Number(values.price.trim().replace(',', '.'))
    return Number.isFinite(value) ? toMinor(value) : 0
  }, [values.price])

  /** Baris tanpa bahan baku dibuang; sisanya menjadi masukan kalkulator HPP. */
  const filledRows = values.rows.filter((r) => r.raw_material_id)

  const hppLines = React.useMemo(
    () =>
      filledRows.map((row) => ({
        quantity: parseQuantity(row.quantity),
        raw_material: byId.get(row.raw_material_id),
      })),
    [filledRows, byId],
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!values.name.trim()) {
      setError('Nama produk wajib diisi.')
      return
    }
    if (!values.price.trim() || priceMinor < 0) {
      setError('Harga jual wajib diisi dan tidak boleh negatif.')
      return
    }

    // Ditolak di klien sebelum request — backend juga menolaknya, tetapi
    // menunggu round-trip untuk kesalahan yang terlihat di layar itu boros.
    const duplicates = findDuplicateRawMaterialIds(filledRows)
    if (duplicates.length) {
      const names = duplicates.map((id) => byId.get(id)?.name ?? id).join(', ')
      setError(`Terdapat bahan baku ganda di dalam resep: ${names}.`)
      return
    }

    const invalidQuantity = filledRows.some((row) => parseQuantity(row.quantity) <= 0)
    if (invalidQuantity) {
      setError('Kuantitas resep harus lebih dari 0.')
      return
    }

    setError(null)

    try {
      await onSubmit({
        name: values.name.trim(),
        price_minor: priceMinor,
        image_url: values.image_url.trim() || undefined,
        // `category_id` SELALU ditimpa backend, termasuk dengan null ([03 §6.4]).
        category_id: values.category_id || null,
        // Penggantian total — array wajib lengkap, bukan hanya yang berubah.
        recipes: filledRows.map((row) => ({
          raw_material_id: row.raw_material_id,
          quantity: parseQuantity(row.quantity),
        })),
      })
      toast.success(editing ? 'Produk diperbarui' : 'Produk ditambahkan')
      router.replace('/admin/products')
    } catch (err) {
      toastApiError(err, 'Gagal menyimpan produk')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-4">
      <PageHeader title={title} />

      {editing ? (
        <Banner tone="warning" title="Resep dikirim utuh setiap kali menyimpan">
          Backend memperlakukan <code>recipes</code> sebagai penggantian total. Form ini selalu
          mengirim seluruh baris resep, sehingga baris yang Anda hapus di sini benar-benar hilang di
          server.
        </Banner>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Informasi Produk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama produk" htmlFor="name" required>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              autoFocus
            />
          </Field>

          <Field label="Kategori" htmlFor="category_id" hint="Opsional.">
            <Select
              id="category_id"
              value={values.category_id}
              onChange={(e) => setValues((v) => ({ ...v, category_id: e.target.value }))}
            >
              <option value="">Tanpa kategori</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Harga jual (Rp)" htmlFor="price" required>
            <NumericInput
              id="price"
              inputMode="decimal"
              value={values.price}
              onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
            />
          </Field>

          <Field
            label="URL gambar"
            htmlFor="image_url"
            hint={
              editing
                ? 'Tidak ada endpoint unggah file. Nilai ini tidak dapat dikosongkan lewat API — mengosongkannya akan diabaikan backend.'
                : 'Opsional. Tidak ada endpoint unggah file — host gambar sendiri lalu tempel URL-nya.'
            }
          >
            <Input
              id="image_url"
              type="url"
              value={values.image_url}
              onChange={(e) => setValues((v) => ({ ...v, image_url: e.target.value }))}
            />
          </Field>
        </CardContent>
      </Card>

      <BomBuilder
        rows={values.rows}
        onChange={(rows) => setValues((v) => ({ ...v, rows }))}
        rawMaterials={materials}
      />

      <HppSummary lines={hppLines} priceMinor={priceMinor} />

      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-pos-sm text-danger">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button variant="neutral" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Produk'}
        </Button>
      </div>
    </form>
  )
}

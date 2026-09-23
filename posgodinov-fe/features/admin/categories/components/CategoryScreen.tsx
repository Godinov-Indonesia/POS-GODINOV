'use client'

import { Tags } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import {
  useCategories,
  useCreateCategoriesBulk,
  useCreateCategory,
} from '@/features/admin/categories/hooks/useCategories'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'

/** D-09 Kategori — docs/04 §B.1. */
export function CategoryScreen() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kategori Produk"
        description="Pengelompokan produk pada tab kasir. Bersifat per-outlet."
      />

      <Banner tone="warning" title="Kategori bersifat permanen">
        Backend tidak menyediakan endpoint ubah maupun hapus kategori — kolom <code>is_deleted</code>{' '}
        ada di tabel tetapi tidak ada cara mengaktifkannya. <strong>Periksa penulisan sebelum
        menyimpan.</strong> Karena itu halaman ini sengaja tidak punya tombol edit atau hapus.
      </Banner>

      <OutletGuard>{(outletId) => <CategoryContent outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function CategoryContent({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useCategories(outletId)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat kategori')
  }, [error])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        {isPending ? (
          <SkeletonTable />
        ) : !data?.length ? (
          <EmptyState
            icon={Tags}
            title="Belum ada kategori"
            description="Produk tanpa kategori tetap muncul di kasir pada tab “Lainnya”, tetapi kategori membuat grid kasir jauh lebih cepat dipindai."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Nama</TH>
                <TH>Deskripsi</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((category) => (
                <TR key={category.id}>
                  <TD className="font-medium">{category.name}</TD>
                  <TD className="text-fg-muted">{category.description || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SingleCategoryForm outletId={outletId} />
        <BulkCategoryForm outletId={outletId} />
      </div>
    </div>
  )
}

function SingleCategoryForm({ outletId }: { outletId: string }) {
  const createCategory = useCreateCategory(outletId)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createCategory.mutateAsync({ name: name.trim(), description: description.trim() })
      toast.success('Kategori ditambahkan')
      setName('')
      setDescription('')
    } catch (error) {
      toastApiError(error, 'Gagal menambahkan kategori')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah kategori</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Nama" htmlFor="category-name" required>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Minuman Panas"
            />
          </Field>
          <Field label="Deskripsi" htmlFor="category-description" hint="Opsional.">
            <Textarea
              id="category-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={createCategory.isPending || !name.trim()}>
            {createCategory.isPending ? 'Menyimpan…' : 'Tambah'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * Tambah massal. Endpoint `/bulk` menerima **array telanjang** dan bersifat
 * all-or-nothing: satu nama kosong menggagalkan seluruh batch ([03 §5.2]).
 */
function BulkCategoryForm({ outletId }: { outletId: string }) {
  const createBulk = useCreateCategoriesBulk(outletId)
  const [raw, setRaw] = React.useState('')

  const names = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!names.length) return
    try {
      await createBulk.mutateAsync(names.map((name) => ({ name, description: '' })))
      toast.success(`${names.length} kategori ditambahkan`)
      setRaw('')
    } catch (error) {
      toastApiError(error, 'Gagal menambahkan kategori massal')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah massal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field
            label="Satu nama per baris"
            htmlFor="category-bulk"
            hint="Seluruh batch dibatalkan bila ada satu baris yang ditolak server."
          >
            <Textarea
              id="category-bulk"
              rows={5}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Minuman Panas\nMinuman Dingin\nMakanan Ringan'}
            />
          </Field>
          <Button type="submit" variant="neutral" disabled={createBulk.isPending || !names.length}>
            {createBulk.isPending ? 'Menyimpan…' : `Tambah ${names.length || ''} kategori`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

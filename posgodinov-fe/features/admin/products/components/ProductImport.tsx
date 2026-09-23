'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCategories } from '@/features/admin/categories/hooks/useCategories'
import { parseProductCsv } from '@/features/admin/products/lib/csv'
import { useCreateProductsBulk } from '@/features/admin/products/hooks/useProducts'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { toMinor } from '@/lib/money'

const TEMPLATE = 'nama,harga,kategori,url_gambar\nKopi Susu Gula Aren,22000,Kopi,\nEs Teh Manis,8000,Non-Kopi,'

/** D-12 Impor Produk Massal — docs/04 §B.1. */
export function ProductImport() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Impor Produk Massal" description="Tempel data dari spreadsheet." />
      <OutletGuard>{(outletId) => <ImportInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function ImportInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { data: categories } = useCategories(outletId)
  const createBulk = useCreateProductsBulk(outletId)
  const [raw, setRaw] = React.useState('')

  const parsed = React.useMemo(() => parseProductCsv(raw), [raw])

  /** Pencocokan kategori berdasarkan nama, tidak peka huruf besar-kecil. */
  const categoryByName = React.useMemo(
    () => new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c])),
    [categories],
  )

  const unknownCategories = React.useMemo(() => {
    const missing = new Set<string>()
    for (const row of parsed.rows) {
      if (row.categoryName && !categoryByName.has(row.categoryName.toLowerCase())) {
        missing.add(row.categoryName)
      }
    }
    return [...missing]
  }, [parsed.rows, categoryByName])

  const submit = async () => {
    if (!parsed.rows.length) return
    try {
      await createBulk.mutateAsync(
        parsed.rows.map((row) => ({
          name: row.name,
          price_minor: toMinor(row.price),
          image_url: row.imageUrl || undefined,
          category_id: categoryByName.get(row.categoryName.toLowerCase())?.id ?? null,
          // Impor massal tidak menyusun BOM — resep ditambahkan lewat D-11.
          recipes: [],
        })),
      )
      toast.success(`${parsed.rows.length} produk diimpor`)
      router.replace('/admin/products')
    } catch (error) {
      toastApiError(error, 'Gagal mengimpor produk')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="warning" title="Impor massal bersifat all-or-nothing">
        Satu baris yang ditolak server membatalkan <strong>seluruh</strong> batch. Produk hasil
        impor juga dibuat <strong>tanpa resep (BOM)</strong> — stoknya tidak akan terpotong sampai
        resep ditambahkan lewat form produk.
      </Banner>

      <Card>
        <CardHeader>
          <CardTitle>Data CSV</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field
            label="Tempel di sini"
            htmlFor="csv"
            hint="Kolom: nama, harga, kategori, url_gambar. Baris header opsional."
          >
            <Textarea
              id="csv"
              rows={10}
              className="font-mono text-pos-sm"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={TEMPLATE}
            />
          </Field>

          <Button variant="ghost" size="sm" className="self-start" onClick={() => setRaw(TEMPLATE)}>
            Isi dengan contoh
          </Button>
        </CardContent>
      </Card>

      {parsed.errors.length > 0 ? (
        <Banner tone="danger" title={`${parsed.errors.length} baris tidak dapat dibaca`}>
          <ul className="list-inside list-disc">
            {parsed.errors.slice(0, 8).map((err) => (
              <li key={err}>{err}</li>
            ))}
            {parsed.errors.length > 8 ? <li>…dan {parsed.errors.length - 8} lainnya.</li> : null}
          </ul>
        </Banner>
      ) : null}

      {unknownCategories.length > 0 ? (
        <Banner tone="warning" title="Kategori tidak dikenal">
          {unknownCategories.join(', ')} — produk terkait akan diimpor <strong>tanpa kategori</strong>.
          Buat kategorinya lebih dulu bila ingin dikelompokkan.
        </Banner>
      ) : null}

      {parsed.rows.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Nama</TH>
                <TH numeric>Harga</TH>
                <TH>Kategori</TH>
                <TH>URL gambar</TH>
              </TR>
            </THead>
            <TBody>
              {parsed.rows.map((row) => (
                <TR key={row.line}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD numeric>
                    <Money minor={toMinor(row.price)} size="sm" />
                  </TD>
                  <TD className="text-fg-muted">{row.categoryName || '—'}</TD>
                  <TD className="max-w-xs truncate text-fg-muted">{row.imageUrl || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={submit} disabled={createBulk.isPending}>
              {createBulk.isPending ? 'Mengimpor…' : `Impor ${parsed.rows.length} produk`}
            </Button>
            <Button variant="neutral" onClick={() => router.back()}>
              Batal
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

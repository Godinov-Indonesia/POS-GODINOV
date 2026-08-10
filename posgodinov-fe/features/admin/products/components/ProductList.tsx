'use client'

import { Package, Plus } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money, Num } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useDeleteProduct, useProducts } from '@/features/admin/products/hooks/useProducts'
import { calculateHpp } from '@/features/admin/products/lib/hpp'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import type { ProductView } from '@/lib/types/domain'

/** D-10 Daftar Produk — docs/04 §B.1. */
export function ProductList() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Produk"
        description="Menu yang tampil di grid kasir, beserta resep (BOM) yang memotong stok."
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/products/import" className={buttonVariants({ variant: 'neutral' })}>
              Impor Massal
            </Link>
            <Link href="/admin/products/new" className={buttonVariants({ variant: 'primary' })}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah Produk
            </Link>
          </div>
        }
      />
      <OutletGuard>{(outletId) => <ProductTable outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function ProductTable({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useProducts(outletId)
  const deleteProduct = useDeleteProduct(outletId)
  const [pendingDelete, setPendingDelete] = React.useState<ProductView | null>(null)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat produk')
  }, [error])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteProduct.mutateAsync(pendingDelete.id)
      toast.success('Produk dihapus')
      setPendingDelete(null)
    } catch (e) {
      toastApiError(e, 'Gagal menghapus produk')
    }
  }

  if (isPending) return <SkeletonTable />

  if (!data?.length) {
    return (
      <EmptyState
        icon={Package}
        title="Belum ada produk"
        description="Grid kasir akan kosong sampai produk pertama dibuat."
        action={
          <Link href="/admin/products/new" className={buttonVariants({ variant: 'primary' })}>
            Tambah Produk
          </Link>
        }
      />
    )
  }

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Nama</TH>
            <TH>Kategori</TH>
            <TH numeric>Harga jual</TH>
            <TH numeric>HPP</TH>
            <TH numeric>Resep</TH>
            <TH>Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((product) => {
            const hppMinor = calculateHpp(product.recipes)
            const belowCost = product.price_minor < hppMinor && product.recipes.length > 0

            return (
              <TR key={product.id}>
                <TD className="font-medium">{product.name}</TD>
                <TD className="text-fg-muted">{product.category?.name ?? '—'}</TD>
                <TD numeric>
                  <Money minor={product.price_minor} size="sm" tone={belowCost ? 'danger' : 'default'} />
                </TD>
                <TD numeric>
                  {product.recipes.length ? (
                    <Money minor={hppMinor} size="sm" tone="muted" />
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </TD>
                <TD numeric>
                  {product.recipes.length === 0 ? (
                    <Badge tone="neutral">Tanpa resep</Badge>
                  ) : (
                    <Num>{product.recipes.length}</Num>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="font-medium text-accent underline"
                    >
                      Ubah
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setPendingDelete(product)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TD>
              </TR>
            )
          })}
        </TBody>
      </Table>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        pending={deleteProduct.isPending}
        title={`Hapus produk ${pendingDelete?.name ?? ''}?`}
        description="Penghapusan bersifat soft delete. Riwayat transaksi yang memuat produk ini tetap utuh. Perangkat kasir baru akan berhenti menampilkannya setelah menjalankan sinkronisasi master data penuh."
      />
    </>
  )
}

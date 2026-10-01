'use client'

import { AlertTriangle, Boxes, Plus } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money, Num, formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import {
  useDeleteRawMaterial,
  useRawMaterials,
} from '@/features/admin/inventory/hooks/useRawMaterials'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import type { RawMaterialView } from '@/lib/types/domain'

/** D-13 Daftar Bahan Baku — docs/04 §B.1. */
export function RawMaterialList() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Bahan Baku"
        description="Kelola daftar bahan baku dan stok inventaris outlet."
        action={
          <Link href="/admin/inventory/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Bahan Baku
          </Link>
        }
      />
      <OutletGuard>{(outletId) => <RawMaterialTable outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function RawMaterialTable({ outletId }: { outletId: string }) {
  const { data, isPending, error } = useRawMaterials(outletId)
  const deleteRawMaterial = useDeleteRawMaterial(outletId)
  const [pendingDelete, setPendingDelete] = React.useState<RawMaterialView | null>(null)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat bahan baku')
  }, [error])

  const negativeCount = data?.filter((m) => m.stock < 0).length ?? 0

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteRawMaterial.mutateAsync(pendingDelete.id)
      toast.success('Bahan baku dihapus')
      setPendingDelete(null)
    } catch (e) {
      toastApiError(e, 'Gagal menghapus bahan baku')
    }
  }

  if (isPending) return <SkeletonTable />

  if (!data?.length) {
    return (
      <EmptyState
        icon={Boxes}
        title="Belum ada bahan baku"
        description="Resep produk menghubungkan menu ke bahan baku. Tambahkan bahan baku agar resep produk dapat disusun untuk melacak pemotongan stok otomatis."
        action={
          <Link href="/admin/inventory/new" className={buttonVariants({ variant: 'primary' })}>
            Tambah Bahan Baku
          </Link>
        }
      />
    )
  }

  return (
    <>
      {negativeCount > 0 ? (
        <Banner tone="warning" icon={AlertTriangle} title={`${negativeCount} bahan baku bersaldo minus`}>
          Stok tercatat negatif karena transaksi penjualan melebihi estimasi stok yang ada.
          Gunakan <strong>Stock Opname</strong> untuk menyesuaikan stok dengan jumlah fisik yang sebenarnya.
        </Banner>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Bahan Baku</TH>
            <TH>Kemasan Utuh</TH>
            <TH>Eceran Terbuka</TH>
            <TH numeric>Total Stok</TH>
            <TH numeric>HPP / unit</TH>
            <TH>Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((material) => {
            const totalStock = material.unit_stock ?? material.stock
            const negative = totalStock < 0
            return (
              <TR key={material.id}>
                <TD className="font-medium">
                  <div>{material.name}</div>
                  {material.sku ? (
                    <div className="font-mono text-xs font-normal text-fg-muted">{material.sku}</div>
                  ) : null}
                  <div className="text-pos-xs text-fg-muted">
                    {material.package_unit && material.quantity_per_package
                      ? `1 ${material.package_unit} = ${formatQuantity(material.quantity_per_package)} ${material.unit}`
                      : `Satuan: ${material.unit}`}
                  </div>
                </TD>
                <TD className="text-fg-muted">
                  {material.package_unit ? (
                    <span>
                      <strong className="font-semibold text-fg">{formatQuantity(material.package_stock)}</strong>{' '}
                      {material.package_unit}
                    </span>
                  ) : (
                    '—'
                  )}
                </TD>
                <TD className="text-fg-muted">
                  <strong className="font-semibold text-fg">{formatQuantity(material.loose_stock)}</strong>{' '}
                  {material.unit}
                </TD>
                <TD numeric>
                  {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]). */}
                  <span
                    className={
                      negative ? 'inline-flex items-center gap-1 font-semibold text-danger' : 'font-medium'
                    }
                  >
                    {negative ? (
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    ) : null}
                    <Num>{formatQuantity(totalStock)}</Num> {material.unit}
                    {negative ? <span className="sr-only">(stok minus)</span> : null}
                  </span>
                </TD>
                <TD numeric>
                  <Money minor={material.cost_per_unit_minor} size="sm" />
                </TD>
                <TD>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/admin/inventory/${material.id}/edit`}
                      className="font-medium text-accent underline"
                    >
                      Ubah
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setPendingDelete(material)}
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
        pending={deleteRawMaterial.isPending}
        title={`Hapus ${pendingDelete?.name ?? ''}?`}
        description="Menghapus bahan baku tidak otomatis menghapus resep produk yang menggunakannya. Pastikan Anda memeriksa kembali resep produk terkait setelah menghapus bahan ini."
      />
    </>
  )
}

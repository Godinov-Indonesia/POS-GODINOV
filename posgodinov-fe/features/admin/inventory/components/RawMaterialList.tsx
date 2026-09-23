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
        description="Inventori dalam base unit. Stok hanya berubah lewat restock, waste, opname, atau sinkronisasi POS."
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
        description="Resep produk (BOM) menghubungkan produk ke bahan baku. Tanpa bahan baku, penyusun resep akan kosong dan stok tidak akan terpotong saat transaksi tersinkronisasi."
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
          Stok negatif <strong>disengaja</strong>: saat sinkronisasi POS, pemotongan stok tidak
          pernah ditolak — transaksi offline yang sudah benar-benar terjadi lebih penting daripada
          konsistensi angka stok. Lakukan Stock Opname untuk mengoreksi.
        </Banner>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Nama</TH>
            <TH>Base Unit</TH>
            <TH>Kemasan</TH>
            <TH numeric>Stok</TH>
            <TH numeric>HPP / unit</TH>
            <TH>Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((material) => {
            const negative = material.stock < 0
            return (
              <TR key={material.id}>
                <TD className="font-medium">{material.name}</TD>
                <TD className="text-fg-muted">{material.unit}</TD>
                <TD className="text-fg-muted">
                  {material.package_unit
                    ? `${material.package_unit} · ${formatQuantity(material.quantity_per_package ?? 0)} ${material.unit}`
                    : '—'}
                </TD>
                <TD numeric>
                  {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]). */}
                  <span
                    className={
                      negative ? 'inline-flex items-center gap-1 font-semibold text-danger' : ''
                    }
                  >
                    {negative ? (
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    ) : null}
                    <Num>{formatQuantity(material.stock)}</Num>
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
        description="Menghapus bahan baku TIDAK menghapus resep produk yang merujuknya. Resep yatim akan tetap ada dan dilewati secara diam-diam saat pemotongan stok — periksa BOM produk terkait setelah ini."
      />
    </>
  )
}

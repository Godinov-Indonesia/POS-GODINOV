'use client'

import { Plus, Store } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toastApiError } from '@/components/ui/toaster'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { formatDateTimeId } from '@/lib/time'

/**
 * D-04 Daftar Outlet.
 *
 * Tidak ada kolom aksi edit/hapus: backend **tidak menyediakan** `PUT` maupun
 * `DELETE` untuk outlet ([03 §3.2]). Menampilkan tombol yang pasti gagal lebih
 * buruk daripada tidak menampilkannya sama sekali ([05 §3.5]).
 */
export function OutletList() {
  const { data, isPending, error } = useOutlets()

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat daftar outlet')
  }, [error])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Outlet"
        description="Cabang yang terdaftar pada bisnis Anda."
        action={
          <Link href="/admin/outlets/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Outlet
          </Link>
        }
      />

      <Banner tone="info">
        Nama dan alamat outlet <strong>tidak dapat diubah</strong> setelah dibuat — backend belum
        menyediakan endpoint pembaruan outlet.
      </Banner>

      {isPending ? (
        <SkeletonTable />
      ) : !data?.length ? (
        <EmptyState
          icon={Store}
          title="Belum ada outlet"
          description="Outlet adalah wadah bagi seluruh kategori, produk, bahan baku, dan staff. Buat satu outlet sebelum melanjutkan."
          action={
            <Link href="/admin/outlets/new" className={buttonVariants({ variant: 'primary' })}>
              Tambah Outlet
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nama</TH>
              <TH>ID Outlet</TH>
              <TH>Serial Tenant</TH>
              <TH>Alamat</TH>
              <TH>Dibuat</TH>
              <TH>Perangkat</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((outlet) => (
              <TR key={outlet.id}>
                <TD className="font-medium">{outlet.name}</TD>
                <TD className="font-mono">{outlet.id}</TD>
                <TD className="font-mono">{outlet.serial_tenant}</TD>
                <TD className="text-fg-muted">{outlet.address || '—'}</TD>
                <TD className="text-fg-muted">{formatDateTimeId(outlet.created_at)}</TD>
                <TD>
                  <Link
                    href={`/admin/outlets/${outlet.id}/provisioning`}
                    className="font-medium text-accent underline"
                  >
                    Info pemasangan
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

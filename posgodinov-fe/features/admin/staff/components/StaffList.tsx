'use client'

import { Ban, Check, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Select } from '@/components/ui/input'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { useDeleteStaff, useStaffList } from '@/features/admin/staff/hooks/useStaff'
import type { Staff } from '@/lib/types/api'

/** D-07 Daftar Staff — filter semua outlet / per outlet ([04 §B.1]). */
export function StaffList() {
  const [outletFilter, setOutletFilter] = React.useState<string>('')
  const { data: outlets } = useOutlets()
  const { data, isPending, error } = useStaffList(outletFilter || null)
  const deleteStaff = useDeleteStaff()
  const [pendingDelete, setPendingDelete] = React.useState<Staff | null>(null)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat daftar staff')
  }, [error])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteStaff.mutateAsync({ id: pendingDelete.id, outletId: pendingDelete.outlet_id })
      toast.success('Staff berhasil dihapus')
      setPendingDelete(null)
    } catch (e) {
      toastApiError(e, 'Gagal menghapus staff')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Staff"
        description="Kasir yang dapat masuk ke perangkat POS."
        action={
          <Link href="/admin/staff/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Staff
          </Link>
        }
      />

      <Banner tone="warning">
        <strong>PIN tidak dapat diubah maupun direset.</strong> Backend tidak menyediakan
        endpoint-nya. Kasir yang lupa PIN harus dihapus lalu didaftarkan ulang.
      </Banner>

      <label className="flex max-w-xs items-center gap-2">
        <span className="shrink-0 text-pos-sm text-fg-muted">Outlet</span>
        <Select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)}>
          <option value="">Semua outlet</option>
          {outlets?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </label>

      {isPending ? (
        <SkeletonTable />
      ) : !data?.length ? (
        <EmptyState
          icon={Users}
          title="Belum ada staff"
          description="Kasir tidak dapat masuk ke perangkat POS sebelum akunnya dibuat di sini."
          action={
            <Link href="/admin/staff/new" className={buttonVariants({ variant: 'primary' })}>
              Tambah Staff
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nama</TH>
              <TH>ID / Username</TH>
              <TH>Outlet</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH>Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((staff) => (
              <TR key={staff.id}>
                <TD className="font-medium">{staff.name}</TD>
                <TD className="font-mono">{staff.staff_identifier}</TD>
                <TD className="font-mono text-fg-muted">{staff.outlet_id}</TD>
                <TD className="text-fg-muted">{staff.email || '—'}</TD>
                <TD>
                  {/* Warna + ikon + teks — penanda kedua wajib ([06 §1.5]). */}
                  {staff.is_active ? (
                    <Badge tone="success" icon={Check}>
                      Aktif
                    </Badge>
                  ) : (
                    <Badge tone="neutral" icon={Ban}>
                      Nonaktif
                    </Badge>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/admin/staff/${staff.id}/edit`}
                      className="font-medium text-accent underline"
                    >
                      Ubah
                    </Link>
                    {/* Jarak ≥ 24px dari aksi lain karena destruktif ([06 §2.1]). */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setPendingDelete(staff)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        pending={deleteStaff.isPending}
        title={`Hapus staff ${pendingDelete?.name ?? ''}?`}
        description="Staff akan dinonaktifkan secara permanen (soft delete). Riwayat shift dan waste yang sudah ada tetap utuh, tetapi akun ini tidak dapat dipulihkan lewat aplikasi."
      />
    </div>
  )
}

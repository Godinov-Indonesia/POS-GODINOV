'use client'

import { ArrowRightLeft, Ban, Check, Plus, ShieldCheck, Users } from 'lucide-react'
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
import { TransferStaffDialog } from '@/features/admin/staff/components/TransferStaffDialog'
import { useDeleteStaff, useStaffList } from '@/features/admin/staff/hooks/useStaff'
import { STAFF_ROLE_LABELS } from '@/lib/constants/staff'
import type { Staff } from '@/lib/types/api'

/** D-07 Daftar Staff — filter semua outlet / per outlet ([04 §B.1]). */
export function StaffList() {
  const [outletFilter, setOutletFilter] = React.useState<string>('')
  const { data: outlets } = useOutlets()
  const { data, isPending, error } = useStaffList(outletFilter || null)
  const deleteStaff = useDeleteStaff()
  const [pendingDelete, setPendingDelete] = React.useState<Staff | null>(null)
  const [transferTarget, setTransferTarget] = React.useState<Staff | null>(null)

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
        description="Kelola akun staf operasional, kasir POS, peran, izin otorisasi, dan mutasi antar outlet."
        action={
          <Link href="/admin/staff/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus className="size-4" aria-hidden="true" />
            Tambah Staff
          </Link>
        }
      />

      <Banner tone="warning">
        <strong>PIN tidak dapat diubah maupun direset.</strong> Backend tidak menyediakan
        endpoint-nya. Staf yang lupa PIN harus dihapus lalu didaftarkan ulang.
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
          description="Staf tidak dapat masuk ke perangkat POS sebelum akunnya dibuat di sini."
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
              <TH>Peran (Role)</TH>
              <TH>Izin Otorisasi</TH>
              <TH>Outlet</TH>
              <TH>Status</TH>
              <TH>Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((staff) => {
              const roleCfg = STAFF_ROLE_LABELS[staff.role] ?? {
                label: staff.role ?? 'Kasir',
                tone: 'neutral' as const,
              }
              const permsCount = staff.permissions?.length ?? 0
              const outletName = outlets?.find((o) => o.id === staff.outlet_id)?.name ?? staff.outlet_id

              return (
                <TR key={staff.id}>
                  <TD className="font-medium text-fg">
                    <div className="flex flex-col">
                      <span>{staff.name}</span>
                      {staff.email ? (
                        <span className="text-pos-xs text-fg-muted">{staff.email}</span>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="font-mono text-pos-sm">{staff.staff_identifier}</TD>
                  <TD>
                    <Badge tone={roleCfg.tone}>{roleCfg.label}</Badge>
                  </TD>
                  <TD>
                    {permsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-accent-subtle/50 px-2 py-0.5 text-pos-xs font-medium text-accent">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        {permsCount} izin
                      </span>
                    ) : (
                      <span className="text-pos-xs text-fg-muted">—</span>
                    )}
                  </TD>
                  <TD className="font-medium text-fg">{outletName}</TD>
                  <TD>
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
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTransferTarget(staff)}
                        title="Pindahkan staf ini ke outlet lain"
                        className="text-accent hover:text-accent-hover"
                      >
                        <ArrowRightLeft className="mr-1 size-3.5" aria-hidden="true" />
                        Pindah
                      </Button>
                      <Link
                        href={`/admin/staff/${staff.id}/edit`}
                        className="font-medium text-accent underline text-pos-sm hover:text-accent-hover"
                      >
                        Ubah
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-subtle"
                        onClick={() => setPendingDelete(staff)}
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
      )}

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        pending={deleteStaff.isPending}
        title={`Hapus staff ${pendingDelete?.name ?? ''}?`}
        description="Staff akan dinonaktifkan secara permanen (soft delete). Riwayat shift dan waste yang sudah ada tetap utuh, tetapi akun ini tidak dapat dipulihkan lewat aplikasi."
      />

      {/* Dialog Transfer Outlet */}
      <TransferStaffDialog
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        staff={transferTarget}
        currentOutletName={outlets?.find((o) => o.id === transferTarget?.outlet_id)?.name}
      />
    </div>
  )
}

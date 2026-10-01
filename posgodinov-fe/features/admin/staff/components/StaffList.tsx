'use client'

import { Archive, ArrowRightLeft, Check, Plus, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Banner, EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Switch } from '@/components/ui/switch'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useActiveOutlet, useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { ArchivedStaffDialog } from '@/features/admin/staff/components/ArchivedStaffDialog'
import { TransferStaffDialog } from '@/features/admin/staff/components/TransferStaffDialog'
import { useStaffList, useUpdateStaff } from '@/features/admin/staff/hooks/useStaff'
import { STAFF_ROLE_LABELS } from '@/lib/constants/staff'
import type { Staff } from '@/lib/types/api'

/** D-07 Daftar Staff — terhubung dengan outlet aktif dari navbar ([04 §B.1]). */
export function StaffList() {
  const activeOutlet = useActiveOutlet()

  return (
    <div className="flex flex-col gap-4">
      <OutletGuard>
        {(outletId) => <StaffListInner outletId={outletId} activeOutletName={activeOutlet?.name} />}
      </OutletGuard>
    </div>
  )
}

function StaffListInner({
  outletId,
  activeOutletName,
}: {
  outletId: string
  activeOutletName?: string
}) {
  const { data: outlets } = useOutlets()
  const { data, isPending, error } = useStaffList(outletId)
  const updateStaff = useUpdateStaff()

  const [transferTarget, setTransferTarget] = React.useState<Staff | null>(null)
  const [isArchiveOpen, setIsArchiveOpen] = React.useState(false)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat daftar staff')
  }, [error])

  // Pisahkan staff aktif dan non-aktif (diarsip)
  const allStaff = data ?? []
  const activeStaff = allStaff.filter((s) => s.is_active)
  const archivedStaff = allStaff.filter((s) => !s.is_active)

  // Toggle status aktif / non-aktif
  const handleToggleActive = async (staff: Staff, nextActive: boolean) => {
    try {
      await updateStaff.mutateAsync({
        id: staff.id,
        body: { is_active: nextActive },
      })
      if (nextActive) {
        toast.success(`Staff ${staff.name} berhasil diaktifkan kembali`)
      } else {
        toast.info(`Staff ${staff.name} dinonaktifkan dan dipindahkan ke Arsip`)
      }
    } catch (err) {
      toastApiError(err, 'Gagal memperbarui status aktif staff')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Staff"
        description={
          activeOutletName
            ? `Kelola staf operasional, kasir POS, dan peran di outlet ${activeOutletName}.`
            : 'Kelola akun staf operasional, kasir POS, dan peran outlet.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="neutral"
              onClick={() => setIsArchiveOpen(true)}
              className="relative"
            >
              <Archive className="size-4" aria-hidden="true" />
              Arsip Non-Aktif
              {archivedStaff.length > 0 ? (
                <span className="ml-1 rounded-full bg-fg-muted/20 px-1.5 py-0.2 text-pos-xs font-semibold">
                  {archivedStaff.length}
                </span>
              ) : null}
            </Button>

            <Link href="/admin/staff/new" className={buttonVariants({ variant: 'primary' })}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah Staff
            </Link>
          </div>
        }
      />

      <Banner tone="info">
        Filter outlet staff mengikuti <strong>outlet aktif yang dipilih pada navbar</strong>. Staf yang dinonaktifkan tersimpan aman di menu Arsip.
      </Banner>

      {isPending ? (
        <SkeletonTable />
      ) : activeStaff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada staff aktif"
          description={
            archivedStaff.length > 0
              ? `Ada ${archivedStaff.length} staf di arsip non-aktif. Anda dapat mengaktifkannya kembali lewat tombol Arsip Non-Aktif.`
              : 'Staf tidak dapat masuk ke perangkat POS sebelum akunnya dibuat di sini.'
          }
          action={
            <div className="flex items-center gap-3">
              {archivedStaff.length > 0 ? (
                <Button variant="neutral" onClick={() => setIsArchiveOpen(true)}>
                  <Archive className="size-4 mr-1.5" />
                  Buka Arsip ({archivedStaff.length})
                </Button>
              ) : null}
              <Link href="/admin/staff/new" className={buttonVariants({ variant: 'primary' })}>
                Tambah Staff
              </Link>
            </div>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nama</TH>
              <TH>ID Kasir</TH>
              <TH>Peran (Role)</TH>
              <TH>Izin Otorisasi</TH>
              <TH>Outlet</TH>
              <TH>Status Aktif</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {activeStaff.map((staff) => {
              const roleCfg = STAFF_ROLE_LABELS[staff.role] ?? {
                label: staff.role ?? 'Kasir',
                tone: 'neutral' as const,
              }
              const permsCount = staff.permissions?.length ?? 0
              const outletName =
                outlets?.find((o) => o.id === staff.outlet_id)?.name ?? staff.outlet_id

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
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={staff.is_active}
                        disabled={updateStaff.isPending}
                        aria-label={`Ubah status aktif staff ${staff.name}`}
                        onCheckedChange={(val) => handleToggleActive(staff, val)}
                      />
                      <Badge tone="success" icon={Check}>
                        Aktif
                      </Badge>
                    </div>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-3">
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
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Dialog Arsip Staff Non-Aktif */}
      <ArchivedStaffDialog
        open={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        archivedStaff={archivedStaff}
        outlets={outlets ?? []}
        onToggleActive={handleToggleActive}
        isUpdating={updateStaff.isPending}
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

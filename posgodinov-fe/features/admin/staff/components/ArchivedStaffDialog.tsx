'use client'

import { Archive, UserCheck } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { STAFF_ROLE_LABELS } from '@/lib/constants/staff'
import type { Outlet, Staff } from '@/lib/types/api'

export function ArchivedStaffDialog({
  open,
  onClose,
  archivedStaff = [],
  outlets = [],
  onToggleActive,
  isUpdating = false,
}: {
  open: boolean
  onClose: () => void
  archivedStaff: Staff[]
  outlets: Outlet[]
  onToggleActive: (staff: Staff, nextActive: boolean) => void
  isUpdating?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Arsip Staff Non-Aktif"
      description="Staf yang dinonaktifkan tidak dapat masuk ke POS. Anda dapat mengaktifkannya kembali sewaktu-waktu."
      className="w-[min(48rem,calc(100vw-2rem))]"
      footer={
        <div className="flex items-center justify-end">
          <Button variant="neutral" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-2">
        {archivedStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-fg-muted">
            <Archive className="size-8 text-fg-subtle" aria-hidden="true" />
            <p className="text-pos-sm font-medium">Tidak ada staff yang diarsip</p>
            <p className="text-pos-xs text-fg-subtle">
              Seluruh akun staf pada outlet ini saat ini berstatus aktif.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                  <TH>ID Kasir</TH>
                  <TH>Peran</TH>
                  <TH>Outlet</TH>
                  <TH className="text-right">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {archivedStaff.map((staff) => {
                  const roleCfg = STAFF_ROLE_LABELS[staff.role] ?? {
                    label: staff.role ?? 'Kasir',
                    tone: 'neutral' as const,
                  }
                  const outletName =
                    outlets.find((o) => o.id === staff.outlet_id)?.name ?? staff.outlet_id

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
                      <TD className="text-pos-sm text-fg-muted">{outletName}</TD>
                      <TD className="text-right">
                        <Button
                          variant="neutral"
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => onToggleActive(staff, true)}
                          className="hover:border-success-text hover:text-success-text"
                        >
                          <UserCheck className="mr-1 size-3.5" aria-hidden="true" />
                          Aktifkan Kembali
                        </Button>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>
    </Dialog>
  )
}

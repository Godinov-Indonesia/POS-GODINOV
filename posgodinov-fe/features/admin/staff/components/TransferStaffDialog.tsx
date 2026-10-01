'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { useTransferStaff } from '@/features/admin/staff/hooks/useStaff'
import type { Staff } from '@/lib/types/api'
import { transferStaffSchema, type TransferStaffForm } from '@/lib/validation/staff'

export function TransferStaffDialog({
  open,
  onClose,
  staff,
  currentOutletName,
}: {
  open: boolean
  onClose: () => void
  staff: Staff | null
  currentOutletName?: string
}) {
  const { data: outlets } = useOutlets()
  const transferStaffMutation = useTransferStaff()

  const availableOutlets = React.useMemo(() => {
    if (!outlets || !staff) return []
    return outlets.filter((o) => o.id !== staff.outlet_id)
  }, [outlets, staff])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransferStaffForm>({
    resolver: zodResolver(transferStaffSchema),
    defaultValues: {
      target_outlet_id: '',
      staff_identifier: staff?.staff_identifier ?? '',
    },
  })

  React.useEffect(() => {
    if (staff && open) {
      reset({
        target_outlet_id: '',
        staff_identifier: staff.staff_identifier,
      })
    }
  }, [staff, open, reset])

  if (!staff) return null

  const onSubmit = handleSubmit(async (values) => {
    try {
      await transferStaffMutation.mutateAsync({
        id: staff.id,
        body: {
          target_outlet_id: values.target_outlet_id,
          staff_identifier: values.staff_identifier?.trim() || undefined,
        },
      })
      toast.success(`Staff ${staff.name} berhasil dipindahkan ke outlet tujuan`)
      onClose()
    } catch (err) {
      toastApiError(err, 'Gagal memindahkan staff')
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Transfer Outlet — ${staff.name}`}
      description="Pindahkan penugasan staf ini ke outlet lain dalam bisnis Anda."
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="neutral" onClick={onClose} disabled={transferStaffMutation.isPending}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={transferStaffMutation.isPending || availableOutlets.length === 0}
          >
            <ArrowRightLeft className="mr-1.5 size-4" aria-hidden="true" />
            {transferStaffMutation.isPending ? 'Memindahkan…' : 'Pindahkan Staff'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
        <Banner tone="warning">
          <strong>Perhatian:</strong> Staf <strong>tidak boleh sedang membuka shift aktif</strong> di outlet
          asal. Jika shift masih terbuka di POS, tutup shift terlebih dahulu sebelum memindahkan staf.
        </Banner>

        <div className="rounded-lg border border-border bg-surface-subtle p-3 text-pos-sm">
          <span className="text-fg-muted">Outlet Saat Ini:</span>{' '}
          <strong className="text-fg">{currentOutletName ?? staff.outlet_id}</strong>
        </div>

        {availableOutlets.length === 0 ? (
          <Banner tone="info">
            Tidak ada outlet tujuan lain yang tersedia. Daftarkan minimal 2 outlet untuk menggunakan fitur transfer.
          </Banner>
        ) : (
          <>
            <Field
              label="Pilih Outlet Tujuan"
              htmlFor="target_outlet_id"
              required
              error={errors.target_outlet_id?.message}
            >
              <Select
                id="target_outlet_id"
                invalid={!!errors.target_outlet_id}
                {...register('target_outlet_id')}
              >
                <option value="">-- Pilih Outlet Tujuan --</option>
                {availableOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="ID / Username di Outlet Tujuan"
              htmlFor="staff_identifier"
              hint="Dapat diubah bila ID ini sudah digunakan di outlet tujuan, atau biarkan sama."
              error={errors.staff_identifier?.message}
            >
              <Input
                id="staff_identifier"
                className="font-mono"
                invalid={!!errors.staff_identifier}
                {...register('staff_identifier')}
              />
            </Field>
          </>
        )}
      </form>
    </Dialog>
  )
}

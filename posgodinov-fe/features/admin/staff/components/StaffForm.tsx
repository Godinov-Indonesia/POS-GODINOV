'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Field, Label } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useOutlets } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { useCreateStaff, useStaffList, useUpdateStaff } from '@/features/admin/staff/hooks/useStaff'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/constants/limits'
import {
  createStaffSchema,
  updateStaffSchema,
  type CreateStaffForm,
  type UpdateStaffForm,
} from '@/lib/validation/staff'

/** D-08 — mode tambah. `outlet_id` dikirim di body, bukan di path ([03 §4.1]). */
export function StaffCreateForm() {
  const router = useRouter()
  const { data: outlets } = useOutlets()
  const createStaff = useCreateStaff()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateStaffForm>({ resolver: zodResolver(createStaffSchema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createStaff.mutateAsync({
        outlet_id: values.outlet_id,
        staff_identifier: values.staff_identifier,
        name: values.name,
        pin: values.pin,
        email: values.email || undefined,
      })
      toast.success('Staff berhasil didaftarkan')
      router.replace('/admin/staff')
    } catch (error) {
      toastApiError(error, 'Gagal mendaftarkan staff')
    }
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Tambah Staff" description="Akun kasir untuk perangkat POS." />

      <Banner tone="warning">
        PIN <strong>tidak dapat diubah</strong> setelah dibuat, dan tidak ada fitur reset PIN.
        Catat PIN ini dan sampaikan langsung kepada kasir yang bersangkutan.
      </Banner>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Outlet" htmlFor="outlet_id" required error={errors.outlet_id?.message}>
              <Select id="outlet_id" invalid={!!errors.outlet_id} {...register('outlet_id')}>
                <option value="">Pilih outlet…</option>
                {outlets?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Nama lengkap" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" invalid={!!errors.name} {...register('name')} />
            </Field>

            <Field
              label="ID / Username"
              htmlFor="staff_identifier"
              required
              error={errors.staff_identifier?.message}
              hint="Harus unik di dalam outlet. Ini yang diketik kasir saat masuk ke POS."
            >
              <Input
                id="staff_identifier"
                className="font-mono"
                invalid={!!errors.staff_identifier}
                {...register('staff_identifier')}
              />
            </Field>

            <Field
              label="PIN"
              htmlFor="pin"
              required
              error={errors.pin?.message}
              hint={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digit angka.`}
            >
              <Input
                id="pin"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_MAX_LENGTH}
                className="font-mono"
                invalid={!!errors.pin}
                {...register('pin')}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Opsional.">
              <Input id="email" type="email" invalid={!!errors.email} {...register('email')} />
            </Field>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={createStaff.isPending}>
                {createStaff.isPending ? 'Menyimpan…' : 'Simpan Staff'}
              </Button>
              <Button variant="neutral" onClick={() => router.back()}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * D-08 — mode ubah.
 *
 * Backend tidak punya `GET /staff/{id}`, sehingga data awal diambil dari daftar
 * seluruh staff yang sudah ada di cache.
 */
export function StaffEditForm({ staffId }: { staffId: string }) {
  const router = useRouter()
  const { data: allStaff, isPending } = useStaffList(null)
  const updateStaff = useUpdateStaff()
  const staff = allStaff?.find((s) => s.id === staffId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateStaffForm>({ resolver: zodResolver(updateStaffSchema) })

  React.useEffect(() => {
    if (staff) {
      reset({
        staff_identifier: staff.staff_identifier,
        name: staff.name,
        email: staff.email ?? '',
        is_active: staff.is_active,
      })
    }
  }, [staff, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateStaff.mutateAsync({
        id: staffId,
        body: {
          staff_identifier: values.staff_identifier,
          name: values.name,
          // `email` bertipe *string di backend: `null` mengosongkan, field yang
          // hilang membiarkan. String kosong dari form berarti "kosongkan".
          email: values.email ? values.email : null,
          is_active: values.is_active,
        },
      })
      toast.success('Staff berhasil diperbarui')
      router.replace('/admin/staff')
    } catch (error) {
      toastApiError(error, 'Gagal memperbarui staff')
    }
  })

  if (isPending) return <Skeleton className="h-96 w-full max-w-2xl" />

  if (!staff) {
    return <Banner tone="danger">Staff tidak ditemukan atau sudah dihapus.</Banner>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={`Ubah Staff — ${staff.name}`} />

      <Banner tone="info">
        PIN tidak muncul di form ini karena backend tidak menyediakan cara mengubahnya.
      </Banner>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Nama lengkap" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" invalid={!!errors.name} {...register('name')} />
            </Field>

            <Field
              label="ID / Username"
              htmlFor="staff_identifier"
              required
              error={errors.staff_identifier?.message}
            >
              <Input
                id="staff_identifier"
                className="font-mono"
                invalid={!!errors.staff_identifier}
                {...register('staff_identifier')}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Kosongkan untuk menghapus email.">
              <Input id="email" type="email" invalid={!!errors.email} {...register('email')} />
            </Field>

            <div className="flex items-center gap-3">
              <input
                id="is_active"
                type="checkbox"
                className="size-5 accent-[var(--accent)]"
                {...register('is_active')}
              />
              <Label htmlFor="is_active">Akun aktif</Label>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={updateStaff.isPending}>
                {updateStaff.isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
              </Button>
              <Button variant="neutral" onClick={() => router.back()}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

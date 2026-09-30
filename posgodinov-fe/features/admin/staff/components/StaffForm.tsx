'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightLeft } from 'lucide-react'
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
import { TransferStaffDialog } from '@/features/admin/staff/components/TransferStaffDialog'
import { useCreateStaff, useStaffList, useUpdateStaff } from '@/features/admin/staff/hooks/useStaff'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/constants/limits'
import {
  ROLE_DEFAULT_PERMISSIONS,
  STAFF_PERMISSION_CONFIG,
  STAFF_PERMISSIONS,
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
} from '@/lib/constants/staff'
import type { StaffPermission, StaffRole } from '@/lib/types/api'
import { cn } from '@/lib/utils/cn'
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

  const [selectedPermissions, setSelectedPermissions] = React.useState<StaffPermission[]>(
    ROLE_DEFAULT_PERMISSIONS.CASHIER,
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateStaffForm>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      role: 'CASHIER',
      permissions: [],
    },
  })

  const currentRole = watch('role')

  const handleRoleChange = (role: StaffRole) => {
    setValue('role', role)
    setSelectedPermissions(ROLE_DEFAULT_PERMISSIONS[role] ?? [])
  }

  const togglePermission = (perm: StaffPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createStaff.mutateAsync({
        outlet_id: values.outlet_id,
        staff_identifier: values.staff_identifier,
        name: values.name,
        pin: values.pin,
        email: values.email || undefined,
        role: values.role,
        permissions: selectedPermissions,
      })
      toast.success('Staff berhasil didaftarkan')
      router.replace('/admin/staff')
    } catch (error) {
      toastApiError(error, 'Gagal mendaftarkan staff')
    }
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Tambah Staff" description="Akun kasir dan staf operasional untuk perangkat POS." />

      <Banner tone="warning">
        PIN <strong>tidak dapat diubah</strong> setelah dibuat, dan tidak ada fitur reset PIN.
        Catat PIN ini dan sampaikan langsung kepada staf yang bersangkutan.
      </Banner>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
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

            {/* Pemilihan Peran (Role) */}
            <Field
              label="Peran (Role)"
              htmlFor="role"
              required
              error={errors.role?.message}
              hint={STAFF_ROLE_LABELS[currentRole]?.description}
            >
              <Select
                id="role"
                value={currentRole}
                onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r].label} ({r})
                  </option>
                ))}
              </Select>
            </Field>

            {/* Granular Permissions Checklist */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-fg">Izin Otorisasi Tambahan (Permissions)</Label>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(ROLE_DEFAULT_PERMISSIONS[currentRole] ?? [])}
                  className="text-pos-xs text-accent underline hover:text-accent-hover"
                >
                  Reset ke Rekomendasi Role
                </button>
              </div>
              <p className="text-pos-xs text-fg-muted">
                Izin granular yang dibawa ke perangkat POS untuk otorisasi offline (Void, Retur, Force Close).
              </p>
              <div className="grid gap-2">
                {STAFF_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm)
                  return (
                    <label
                      key={perm}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        isChecked ? 'border-brand bg-accent-subtle/20' : 'border-border hover:bg-surface-subtle',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-brand cursor-pointer rounded"
                        checked={isChecked}
                        onChange={() => togglePermission(perm)}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-pos-sm font-semibold text-fg">
                          {STAFF_PERMISSION_CONFIG[perm].label}
                        </span>
                        <span className="text-pos-xs text-fg-muted">
                          {STAFF_PERMISSION_CONFIG[perm].description}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
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
 * Mengizinkan pembaruan nama, ID/username, email, status aktif, role, dan permissions.
 * Tersedia juga tombol Transfer Outlet untuk memindahkan penugasan staff antar-cabang.
 */
export function StaffEditForm({ staffId }: { staffId: string }) {
  const router = useRouter()
  const { data: allStaff, isPending: loadingStaff } = useStaffList(null)
  const { data: outlets } = useOutlets()
  const updateStaff = useUpdateStaff()

  const staff = allStaff?.find((s) => s.id === staffId)
  const [selectedPermissions, setSelectedPermissions] = React.useState<StaffPermission[]>([])
  const [showTransferDialog, setShowTransferDialog] = React.useState(false)

  const currentOutlet = outlets?.find((o) => o.id === staff?.outlet_id)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateStaffForm>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      role: 'CASHIER',
      is_active: true,
      permissions: [],
    },
  })

  const currentRole = watch('role')

  React.useEffect(() => {
    if (staff) {
      const initialRole = staff.role ?? 'CASHIER'
      const initialPerms = (staff.permissions as StaffPermission[]) ?? ROLE_DEFAULT_PERMISSIONS[initialRole] ?? []
      reset({
        staff_identifier: staff.staff_identifier,
        name: staff.name,
        email: staff.email ?? '',
        role: initialRole,
        is_active: staff.is_active,
      })
      setSelectedPermissions(initialPerms)
    }
  }, [staff, reset])

  const handleRoleChange = (role: StaffRole) => {
    setValue('role', role)
  }

  const togglePermission = (perm: StaffPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateStaff.mutateAsync({
        id: staffId,
        body: {
          staff_identifier: values.staff_identifier,
          name: values.name,
          email: values.email ? values.email : null,
          role: values.role,
          permissions: selectedPermissions,
          is_active: values.is_active,
        },
      })
      toast.success('Staff berhasil diperbarui')
      router.replace('/admin/staff')
    } catch (error) {
      toastApiError(error, 'Gagal memperbarui staff')
    }
  })

  if (loadingStaff) return <Skeleton className="h-96 w-full max-w-2xl" />

  if (!staff) {
    return <Banner tone="danger">Staff tidak ditemukan atau sudah dihapus.</Banner>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={`Ubah Staff — ${staff.name}`} />

      {/* Banner & Outlet Card */}
      <div className="flex flex-col gap-3">
        <Banner tone="info">
          PIN tidak muncul di form ini karena backend tidak menyediakan cara mengubahnya.
        </Banner>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle p-4 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-pos-sm font-semibold text-fg">Penugasan Outlet Saat Ini</span>
            <span className="text-pos-xs text-fg-muted">
              Bertugas di: <strong className="text-fg">{currentOutlet?.name ?? staff.outlet_id}</strong>
            </span>
          </div>
          <Button
            type="button"
            variant="neutral"
            size="sm"
            onClick={() => setShowTransferDialog(true)}
          >
            <ArrowRightLeft className="mr-1.5 size-4 text-accent" aria-hidden="true" />
            Pindah ke Outlet Lain
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
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

            {/* Pemilihan Peran (Role) */}
            <Field
              label="Peran (Role)"
              htmlFor="role"
              required
              error={errors.role?.message}
              hint={STAFF_ROLE_LABELS[currentRole]?.description}
            >
              <Select
                id="role"
                value={currentRole}
                onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r].label} ({r})
                  </option>
                ))}
              </Select>
            </Field>

            {/* Granular Permissions Checklist */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-fg">Izin Otorisasi Tambahan (Permissions)</Label>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(ROLE_DEFAULT_PERMISSIONS[currentRole] ?? [])}
                  className="text-pos-xs text-accent underline hover:text-accent-hover"
                >
                  Gunakan Rekomendasi Role
                </button>
              </div>
              <p className="text-pos-xs text-fg-muted">
                Izin granular yang dibawa ke perangkat POS untuk otorisasi offline (Void, Retur, Force Close).
              </p>
              <div className="grid gap-2">
                {STAFF_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm)
                  return (
                    <label
                      key={perm}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        isChecked ? 'border-brand bg-accent-subtle/20' : 'border-border hover:bg-surface-subtle',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-brand cursor-pointer rounded"
                        checked={isChecked}
                        onChange={() => togglePermission(perm)}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-pos-sm font-semibold text-fg">
                          {STAFF_PERMISSION_CONFIG[perm].label}
                        </span>
                        <span className="text-pos-xs text-fg-muted">
                          {STAFF_PERMISSION_CONFIG[perm].description}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                id="is_active"
                type="checkbox"
                className="size-5 accent-[var(--accent)]"
                {...register('is_active')}
              />
              <Label htmlFor="is_active">Akun aktif</Label>
            </div>

            <div className="flex items-center gap-2 pt-2">
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

      <TransferStaffDialog
        open={showTransferDialog}
        onClose={() => setShowTransferDialog(false)}
        staff={staff}
        currentOutletName={currentOutlet?.name}
      />
    </div>
  )
}

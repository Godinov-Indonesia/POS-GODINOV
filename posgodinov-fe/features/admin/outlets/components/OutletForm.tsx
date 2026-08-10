'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCreateOutlet } from '@/features/admin/outlets/hooks/useOutlets'
import { PageHeader } from '@/features/admin/shell/PageHeader'

const schema = z.object({
  name: z.string().min(1, 'Nama outlet wajib diisi'),
  address: z.string().optional(),
})

type Values = z.infer<typeof schema>

/** D-05 Form Tambah Outlet — docs/03 §3.1. */
export function OutletForm() {
  const router = useRouter()
  const createOutlet = useCreateOutlet()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const outlet = await createOutlet.mutateAsync({
        name: values.name,
        address: values.address || undefined,
      })
      toast.success('Outlet berhasil didaftarkan')
      // Langsung ke halaman provisioning: `serial_tenant` baru saja lahir dan
      // tidak dapat diambil lewat endpoint lain ([04 §B.2]).
      router.replace(`/admin/outlets/${outlet.id}/provisioning`)
    } catch (error) {
      toastApiError(error, 'Gagal mendaftarkan outlet')
    }
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Tambah Outlet" description="Cabang baru untuk bisnis Anda." />

      <Banner tone="warning">
        Periksa penulisan dengan teliti. Backend belum menyediakan endpoint untuk mengubah atau
        menghapus outlet, sehingga <strong>nama dan alamat bersifat permanen</strong>.
      </Banner>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Nama outlet" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" autoFocus invalid={!!errors.name} {...register('name')} />
            </Field>

            <Field label="Alamat" htmlFor="address" hint="Opsional.">
              <Textarea id="address" rows={3} {...register('address')} />
            </Field>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={createOutlet.isPending}>
                {createOutlet.isPending ? 'Menyimpan…' : 'Simpan Outlet'}
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

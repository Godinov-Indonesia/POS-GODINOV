'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toastApiError } from '@/components/ui/toaster'
import { resetPassword } from '@/lib/api/endpoints/auth'

const schema = z
  .object({
    new_password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmation_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirmation_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmation_password'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="danger">
          Token reset tidak ditemukan. Silakan minta ulang tautan reset password.
        </Banner>
        <p className="text-center text-pos-sm text-fg-muted">
          <Link href="/forgot-password" className="font-medium text-accent underline">
            Minta ulang tautan
          </Link>
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="info">
          Password berhasil diperbarui! Silakan login dengan password baru Anda.
        </Banner>
        <p className="text-center text-pos-sm text-fg-muted">
          <Link href="/login" className="font-medium text-accent underline">
            Login sekarang
          </Link>
        </p>
      </div>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setPending(true)
    try {
      await resetPassword({ token, ...values })
      setDone(true)
    } catch (error) {
      toastApiError(error, 'Gagal reset password')
    } finally {
      setPending(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-pos-base font-semibold text-fg">Buat Password Baru</p>
        <p className="text-pos-sm text-fg-muted">Masukkan password baru untuk akun Anda.</p>
      </div>

      <Field label="Password Baru" htmlFor="new_password" required error={errors.new_password?.message}>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          autoFocus
          invalid={!!errors.new_password}
          {...register('new_password')}
        />
      </Field>

      <Field
        label="Konfirmasi Password"
        htmlFor="confirmation_password"
        required
        error={errors.confirmation_password?.message}
      >
        <Input
          id="confirmation_password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirmation_password}
          {...register('confirmation_password')}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan Password Baru'}
      </Button>
    </form>
  )
}

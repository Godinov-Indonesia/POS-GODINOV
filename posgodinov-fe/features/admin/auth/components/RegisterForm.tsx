'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toastApiError } from '@/components/ui/toaster'
import { useAuthFlow } from '@/features/admin/auth/hooks/useAuthFlow'
import { registerSchema, type RegisterForm as RegisterValues } from '@/lib/validation/auth'

const INPUT_CLASS = 'h-touch rounded-full px-4'

/** D-02 Registrasi — docs/03 §1.1. Rate limit 10 request/menit per IP. */
export function RegisterForm() {
  const { register: submitRegister, pending } = useAuthFlow()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submitRegister(values)
    } catch (error) {
      toastApiError(error, 'Gagal mendaftarkan bisnis')
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-pos-xl font-bold tracking-tight text-fg">Daftarkan Bisnis</h1>
        <p className="text-pos-sm text-fg-muted">
          Buat akun untuk mulai mengelola kasir, stok, dan laporan bisnis Anda.
        </p>
      </div>

      <Banner tone="info">
        Nama bisnis dan nama pemilik dipakai untuk membentuk <strong>serial bisnis</strong> —
        nilai yang dibutuhkan teknisi saat memasang perangkat kasir. Keduanya tidak dapat
        diubah setelah pendaftaran.
      </Banner>

      <Field label="Nama bisnis" htmlFor="name" required error={errors.name?.message}>
        <Input id="name" autoFocus invalid={!!errors.name} className={INPUT_CLASS} {...register('name')} />
      </Field>

      <Field label="Nama pemilik" htmlFor="owner_name" required error={errors.owner_name?.message}>
        <Input
          id="owner_name"
          invalid={!!errors.owner_name}
          className={INPUT_CLASS}
          {...register('owner_name')}
        />
      </Field>

      <Field label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          className={INPUT_CLASS}
          {...register('email')}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={errors.password?.message}
        hint="Minimal 8 karakter."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          className={INPUT_CLASS}
          {...register('password')}
        />
      </Field>

      <Field
        label="Konfirmasi password"
        htmlFor="confirmation_password"
        required
        error={errors.confirmation_password?.message}
      >
        <Input
          id="confirmation_password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirmation_password}
          className={INPUT_CLASS}
          {...register('confirmation_password')}
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={pending}
        className="rounded-full"
      >
        {pending ? 'Mendaftarkan…' : 'Daftarkan bisnis'}
        {!pending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
      </Button>

      <p className="text-center text-pos-sm text-fg-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-medium text-accent underline">
          Masuk
        </Link>
      </p>
    </form>
  )
}

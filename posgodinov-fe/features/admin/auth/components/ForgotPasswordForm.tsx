'use client'

import Link from 'next/link'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { forgotPassword } from '@/lib/api/endpoints/auth'

const schema = z.object({
  email: z.string().email('Masukkan alamat email yang valid'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setPending(true)
    try {
      await forgotPassword(values)
    } catch {
      // Tetap tampilkan pesan sukses untuk mencegah user enumeration
    } finally {
      setPending(false)
      setSubmitted(true)
    }
  })

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="info">
          Jika email tersebut terdaftar, instruksi reset password telah dikirim. Periksa inbox Anda.
        </Banner>
        <p className="text-center text-pos-sm text-fg-muted">
          <Link href="/login" className="font-medium text-accent underline">
            Kembali ke halaman login
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-pos-base font-semibold text-fg">Lupa Password</p>
        <p className="text-pos-sm text-fg-muted">
          Masukkan email yang terdaftar. Kami akan mengirimkan tautan reset password.
        </p>
      </div>

      <Field label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          invalid={!!errors.email}
          {...register('email')}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Mengirim…' : 'Kirim Tautan Reset'}
      </Button>

      <p className="text-center text-pos-sm text-fg-muted">
        <Link href="/login" className="font-medium text-accent underline">
          Kembali ke login
        </Link>
      </p>
    </form>
  )
}

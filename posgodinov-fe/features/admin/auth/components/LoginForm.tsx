'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Store } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toastApiError } from '@/components/ui/toaster'
import { useAuthFlow } from '@/features/admin/auth/hooks/useAuthFlow'
import { loginSchema, type LoginForm as LoginValues } from '@/lib/validation/auth'

/** D-01 Login — docs/04 §B.1, alur di docs/05 §1.4.4. */
export function LoginForm() {
  const searchParams = useSearchParams()
  const expired = searchParams.get('reason') === 'expired'
  const { login, pending, outletChoices, chooseOutlet } = useAuthFlow()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values)
    } catch (error) {
      // Backend mengembalikan pesan generik yang sama untuk email tidak
      // ditemukan maupun password salah — praktik yang tepat untuk mencegah
      // user enumeration. Tampilkan apa adanya ([05 §3.2]).
      toastApiError(error, 'Gagal login')
    }
  })

  if (outletChoices) return <OutletChooser outlets={outletChoices} onChoose={chooseOutlet} />

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {expired ? (
        <Banner tone="warning">Sesi Anda telah berakhir. Silakan masuk kembali.</Banner>
      ) : null}

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

      <Field label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          {...register('password')}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Memproses…' : 'Masuk'}
      </Button>

      <p className="text-center text-pos-sm text-fg-muted">
        Belum punya akun?{' '}
        <Link href="/register" className="font-medium text-accent underline">
          Daftarkan bisnis
        </Link>
      </p>
    </form>
  )
}

/**
 * Pemilih outlet pasca-login untuk bisnis dengan lebih dari satu outlet.
 * `serial_tenant` ditampilkan karena teknisi membutuhkannya saat binding POS.
 */
function OutletChooser({
  outlets,
  onChoose,
}: {
  outlets: { id: string; name: string; serial_tenant: string }[]
  onChoose: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-pos-sm text-fg-muted">Pilih outlet yang ingin Anda kelola.</p>
      <ul className="flex flex-col gap-2">
        {outlets.map((outlet) => (
          <li key={outlet.id}>
            <button
              type="button"
              onClick={() => onChoose(outlet.id)}
              className="flex min-h-touch w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left hover:border-accent hover:bg-accent-subtle"
            >
              <Store className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-pos-base font-medium text-fg">{outlet.name}</span>
                <span className="font-mono text-pos-xs text-fg-subtle">
                  {outlet.serial_tenant}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

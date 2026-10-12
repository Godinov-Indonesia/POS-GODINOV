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
import { BASE_URL } from '@/lib/api/http'

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

  const handleGoogleLogin = () => {
    // Arahkan browser ke BE OAuth redirect endpoint.
    // BE set state cookie → redirect ke Google → Google callback ke BE →
    // BE proses → redirect ke /oauth/callback?access_token=...
    window.location.href = `${BASE_URL}/v1/auth/business/oauth/google`
  }

  if (outletChoices) return <OutletChooser outlets={outletChoices} onChoose={chooseOutlet} />

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {expired ? (
        <Banner tone="warning">Sesi Anda telah berakhir. Silakan masuk kembali.</Banner>
      ) : null}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-pos-sm font-medium text-fg hover:bg-accent-subtle transition-colors"
      >
        {/* Google Logo SVG */}
        <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Lanjutkan dengan Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-pos-xs text-fg-subtle">atau</span>
        <div className="h-px flex-1 bg-border" />
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

      <Field label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          {...register('password')}
        />
      </Field>

      {/* Forgot password link */}
      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-pos-xs text-fg-muted underline underline-offset-2 hover:text-accent"
        >
          Lupa password?
        </Link>
      </div>

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

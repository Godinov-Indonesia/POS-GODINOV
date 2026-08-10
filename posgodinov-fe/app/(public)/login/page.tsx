import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Skeleton } from '@/components/ui/feedback'
import { LoginForm } from '@/features/admin/auth/components/LoginForm'

export const metadata: Metadata = { title: 'Masuk' }

/** D-01 — docs/04 §B.1. */
export default function LoginPage() {
  return (
    // `useSearchParams` (membaca `?reason=expired`) wajib berada di bawah
    // Suspense agar halaman tetap dapat di-prerender.
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LoginForm />
    </Suspense>
  )
}

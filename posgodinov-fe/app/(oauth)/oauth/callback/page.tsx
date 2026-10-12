import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OAuthCallbackHandler } from '@/features/admin/auth/components/OAuthCallbackHandler'

export const metadata: Metadata = { title: 'Memproses Login…' }

/** Quarantine page untuk OAuth Google — blank, tanpa AuthShell wrapper. */
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackHandler />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ImpersonateCallbackHandler } from '@/features/admin/auth/components/ImpersonateCallbackHandler'

export const metadata: Metadata = { title: 'Memproses Impersonasi…' }

/** Blank quarantine page untuk Impersonasi Merchant dari Landlord. */
export default function ImpersonateLoginPage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateCallbackHandler />
    </Suspense>
  )
}

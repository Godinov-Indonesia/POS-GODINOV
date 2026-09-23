import type { Metadata } from 'next'

import { RegisterForm } from '@/features/admin/auth/components/RegisterForm'

export const metadata: Metadata = { title: 'Daftarkan bisnis' }

/** D-02 — docs/04 §B.1. */
export default function RegisterPage() {
  return <RegisterForm />
}

import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/features/admin/auth/components/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Lupa Password' }

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}

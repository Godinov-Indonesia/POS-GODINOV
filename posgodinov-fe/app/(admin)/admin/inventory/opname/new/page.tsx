import type { Metadata } from 'next'

import { SOCreateForm } from '@/features/admin/so/components/SOCreateForm'

export const metadata: Metadata = { title: 'Buat Form Stock Opname' }

export default function NewSOFormPage() {
  return <SOCreateForm />
}

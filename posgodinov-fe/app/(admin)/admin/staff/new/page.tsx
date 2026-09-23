import type { Metadata } from 'next'

import { StaffCreateForm } from '@/features/admin/staff/components/StaffForm'

export const metadata: Metadata = { title: 'Tambah Staff' }

/** D-08 (tambah) — docs/04 §B.1. */
export default function NewStaffPage() {
  return <StaffCreateForm />
}

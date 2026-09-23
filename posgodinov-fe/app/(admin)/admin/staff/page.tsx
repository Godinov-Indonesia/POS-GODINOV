import type { Metadata } from 'next'

import { StaffList } from '@/features/admin/staff/components/StaffList'

export const metadata: Metadata = { title: 'Staff' }

/** D-07 — docs/04 §B.1. */
export default function StaffPage() {
  return <StaffList />
}

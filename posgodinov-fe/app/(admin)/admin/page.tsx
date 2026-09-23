import type { Metadata } from 'next'

import { DashboardScreen } from '@/features/admin/dashboard/components/DashboardScreen'

export const metadata: Metadata = { title: 'Dashboard' }

/** D-03 — docs/04 §B.1. */
export default function AdminDashboardPage() {
  return <DashboardScreen />
}

import type { Metadata } from 'next'

import { OutletList } from '@/features/admin/outlets/components/OutletList'

export const metadata: Metadata = { title: 'Outlet' }

/** D-04 — docs/04 §B.1. */
export default function OutletsPage() {
  return <OutletList />
}

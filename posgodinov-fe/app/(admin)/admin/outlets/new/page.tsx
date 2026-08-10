import type { Metadata } from 'next'

import { OutletForm } from '@/features/admin/outlets/components/OutletForm'

export const metadata: Metadata = { title: 'Tambah Outlet' }

/** D-05 — docs/04 §B.1. */
export default function NewOutletPage() {
  return <OutletForm />
}

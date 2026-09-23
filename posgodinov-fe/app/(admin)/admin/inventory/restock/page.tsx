import type { Metadata } from 'next'

import { RestockForm } from '@/features/admin/inventory/components/RestockForm'

export const metadata: Metadata = { title: 'Restock' }

/** D-15 — docs/04 §B.1. */
export default function RestockPage() {
  return <RestockForm />
}

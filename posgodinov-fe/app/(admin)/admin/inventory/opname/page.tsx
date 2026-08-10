import type { Metadata } from 'next'

import { OpnameSheet } from '@/features/admin/inventory/components/OpnameSheet'

export const metadata: Metadata = { title: 'Stock Opname' }

/** D-19 — docs/04 §B.1. */
export default function OpnamePage() {
  return <OpnameSheet />
}

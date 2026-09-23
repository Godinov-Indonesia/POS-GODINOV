import type { Metadata } from 'next'

import { WasteForm } from '@/features/admin/inventory/components/WasteForm'

export const metadata: Metadata = { title: 'Waste Bahan Baku' }

/** D-17 — docs/04 §B.1. */
export default function WastePage() {
  return <WasteForm />
}

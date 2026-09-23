import type { Metadata } from 'next'

import { RawMaterialList } from '@/features/admin/inventory/components/RawMaterialList'

export const metadata: Metadata = { title: 'Bahan Baku' }

/** D-13 — docs/04 §B.1. */
export default function InventoryPage() {
  return <RawMaterialList />
}

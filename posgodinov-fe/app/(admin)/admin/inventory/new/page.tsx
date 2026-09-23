import type { Metadata } from 'next'

import { RawMaterialCreateForm } from '@/features/admin/inventory/components/RawMaterialForm'

export const metadata: Metadata = { title: 'Tambah Bahan Baku' }

/** D-14 (tambah) — docs/04 §B.1. */
export default function NewRawMaterialPage() {
  return <RawMaterialCreateForm />
}

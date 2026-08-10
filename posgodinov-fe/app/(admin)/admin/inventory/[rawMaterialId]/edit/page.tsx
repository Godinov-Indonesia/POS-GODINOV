import type { Metadata } from 'next'

import { RawMaterialEditForm } from '@/features/admin/inventory/components/RawMaterialForm'

export const metadata: Metadata = { title: 'Ubah Bahan Baku' }

/** D-14 (ubah) — docs/04 §B.1. TANPA field stok ([03 §7.4]). */
export default async function EditRawMaterialPage(
  props: PageProps<'/admin/inventory/[rawMaterialId]/edit'>,
) {
  const { rawMaterialId } = await props.params
  return <RawMaterialEditForm rawMaterialId={rawMaterialId} />
}

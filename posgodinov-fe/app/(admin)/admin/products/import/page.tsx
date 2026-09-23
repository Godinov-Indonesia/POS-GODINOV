import type { Metadata } from 'next'

import { ProductImport } from '@/features/admin/products/components/ProductImport'

export const metadata: Metadata = { title: 'Impor Produk Massal' }

/** D-12 — docs/04 §B.1. */
export default function ImportProductsPage() {
  return <ProductImport />
}

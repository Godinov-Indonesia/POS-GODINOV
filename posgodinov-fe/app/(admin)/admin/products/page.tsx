import type { Metadata } from 'next'

import { ProductList } from '@/features/admin/products/components/ProductList'

export const metadata: Metadata = { title: 'Produk' }

/** D-10 — docs/04 §B.1. */
export default function ProductsPage() {
  return <ProductList />
}

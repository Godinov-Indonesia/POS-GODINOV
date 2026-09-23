import type { Metadata } from 'next'

import { ProductCreateForm } from '@/features/admin/products/components/ProductForm'

export const metadata: Metadata = { title: 'Tambah Produk' }

/** D-11 (tambah) — docs/04 §B.1. */
export default function NewProductPage() {
  return <ProductCreateForm />
}

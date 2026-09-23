import type { Metadata } from 'next'

import { ProductEditForm } from '@/features/admin/products/components/ProductForm'

export const metadata: Metadata = { title: 'Ubah Produk' }

/** D-11 (ubah) — docs/04 §B.1. */
export default async function EditProductPage(props: PageProps<'/admin/products/[productId]/edit'>) {
  const { productId } = await props.params
  return <ProductEditForm productId={productId} />
}

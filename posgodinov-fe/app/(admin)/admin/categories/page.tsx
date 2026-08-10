import type { Metadata } from 'next'

import { CategoryScreen } from '@/features/admin/categories/components/CategoryScreen'

export const metadata: Metadata = { title: 'Kategori' }

/** D-09 — docs/04 §B.1. */
export default function CategoriesPage() {
  return <CategoryScreen />
}

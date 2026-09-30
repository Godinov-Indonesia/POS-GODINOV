import type { Metadata } from 'next'

import { SOFormList } from '@/features/admin/so/components/SOFormList'

export const metadata: Metadata = { title: 'Stock Opname' }

export default function OpnamePage() {
  return <SOFormList />
}

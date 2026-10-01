import type { Metadata } from 'next'

import { SOFormDetail } from '@/features/admin/so/components/SOFormDetail'

export const metadata: Metadata = { title: 'Detail Stock Opname' }

export default async function SOFormDetailPage(props: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await props.params
  return <SOFormDetail formId={formId} />
}

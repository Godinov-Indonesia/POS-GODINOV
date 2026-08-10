import type { Metadata } from 'next'

import { ProvisioningCard } from '@/features/admin/outlets/components/ProvisioningCard'

export const metadata: Metadata = { title: 'Info Pemasangan Perangkat' }

/** D-06 — docs/04 §B.1. `params` bertipe Promise dan wajib di-`await`. */
export default async function ProvisioningPage(
  props: PageProps<'/admin/outlets/[outletId]/provisioning'>,
) {
  const { outletId } = await props.params
  return <ProvisioningCard outletId={outletId} />
}

import type { Metadata } from 'next'

import { SubscriptionOfferingScreen } from '@/features/admin/subscription/components/SubscriptionOfferingScreen'

export const metadata: Metadata = { title: 'Paket & Upgrade Langganan' }

export default function SubscriptionPage() {
  return <SubscriptionOfferingScreen />
}

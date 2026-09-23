import type { Metadata } from 'next'

import { OnboardingChecklist } from '@/features/admin/onboarding/components/OnboardingChecklist'

export const metadata: Metadata = { title: 'Panduan Setup' }

export default function OnboardingPage() {
  return <OnboardingChecklist />
}

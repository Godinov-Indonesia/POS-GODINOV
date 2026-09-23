import type { Metadata } from 'next'

import { ShiftReconciliation } from '@/features/admin/reports/components/ShiftReconciliation'

export const metadata: Metadata = { title: 'Rekonsiliasi Shift' }

/** Layar pemilik untuk butir 9 — Blind Closing ([11 §M15.3]). */
export default function ShiftReconciliationPage() {
  return <ShiftReconciliation />
}

import type { Metadata } from 'next'

import { OpnameReport } from '@/features/admin/reports/components/InventoryReports'

export const metadata: Metadata = { title: 'Laporan Opname' }

/** D-20 — docs/04 §B.1. */
export default function OpnameReportPage() {
  return <OpnameReport />
}

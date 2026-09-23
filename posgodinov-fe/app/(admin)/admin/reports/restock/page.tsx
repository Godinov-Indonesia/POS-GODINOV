import type { Metadata } from 'next'

import { RestockReport } from '@/features/admin/reports/components/InventoryReports'

export const metadata: Metadata = { title: 'Laporan Restock' }

/** D-16 — docs/04 §B.1. */
export default function RestockReportPage() {
  return <RestockReport />
}

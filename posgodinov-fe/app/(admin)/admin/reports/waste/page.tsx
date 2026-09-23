import type { Metadata } from 'next'

import { WasteReport } from '@/features/admin/reports/components/InventoryReports'

export const metadata: Metadata = { title: 'Laporan Waste' }

/** D-18 — docs/04 §B.1. */
export default function WasteReportPage() {
  return <WasteReport />
}

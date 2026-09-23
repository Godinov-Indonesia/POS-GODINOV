import type { Metadata } from 'next'

import { TransactionReport } from '@/features/admin/reports/components/TransactionReport'

export const metadata: Metadata = { title: 'Laporan Transaksi' }

/** D-21 — docs/04 §B.1. */
export default function TransactionReportPage() {
  return <TransactionReport />
}

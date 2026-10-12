'use client'

import { DateRangeFilter, type DateRangeFilterProps } from '@/components/ui/date-range-filter'

export { DateRangeFilter }
export type { DateRangeFilterProps }

/**
 * Pemilih rentang tanggal laporan — docs/05 §1.8.3.
 * Menggunakan komponen DateRangeFilter reusable yang baru.
 */
export const DateRangePicker = DateRangeFilter

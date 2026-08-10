'use client'

import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { getDashboard, listTransactionReport } from '@/lib/api/endpoints/reports'
import { queryKeys } from '@/lib/query/keys'
import { isRangeWithinLimit, lastNDays, type DateRange } from '@/lib/time'

/** Default 7 hari — sama dengan batas keras, sehingga selalu sah. */
export function useDateRange(initialDays = 7) {
  return React.useState<DateRange>(() => lastNDays(initialDays))
}

export function useDashboard(outletId: string | null, range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reportDashboard(outletId ?? '', range),
    queryFn: () => getDashboard(outletId!, range),
    // Rentang di luar batas TIDAK dikirim: request-nya sah menurut backend,
    // tetapi responsnya berpotensi puluhan megabita ([03 §11.2]).
    enabled: !!outletId && isRangeWithinLimit(range),
  })
}

export function useTransactionReport(outletId: string | null, range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reportTransactions(outletId ?? '', range),
    queryFn: () => listTransactionReport(outletId!, range),
    enabled: !!outletId && isRangeWithinLimit(range),
  })
}

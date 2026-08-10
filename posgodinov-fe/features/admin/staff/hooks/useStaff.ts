'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createStaff,
  deleteStaff,
  listAllStaff,
  listStaffByOutlet,
  updateStaff,
} from '@/lib/api/endpoints/staff'
import { queryKeys } from '@/lib/query/keys'
import type { CreateStaffRequest, UpdateStaffRequest } from '@/lib/types/api'

/**
 * `outletId === null` berarti "semua outlet" (`GET /v1/business/staff`), yang
 * dipakai halaman manajemen staff terpusat D-07.
 */
export function useStaffList(outletId: string | null) {
  return useQuery({
    queryKey: outletId ? queryKeys.staff(outletId) : queryKeys.allStaff(),
    queryFn: () => (outletId ? listStaffByOutlet(outletId) : listAllStaff()),
  })
}

/** Kedua cakupan (per-outlet dan semua outlet) ikut basi setiap kali staff berubah. */
function useInvalidateStaff() {
  const queryClient = useQueryClient()
  return (outletId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allStaff() })
    if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.staff(outletId) })
  }
}

export function useCreateStaff() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: (body: CreateStaffRequest) => createStaff(body),
    onSuccess: (staff) => invalidate(staff.outlet_id),
  })
}

export function useUpdateStaff() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStaffRequest }) => updateStaff(id, body),
    onSuccess: (staff) => invalidate(staff.outlet_id),
  })
}

export function useDeleteStaff() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: ({ id }: { id: string; outletId: string }) => deleteStaff(id),
    onSuccess: (_data, variables) => invalidate(variables.outletId),
  })
}

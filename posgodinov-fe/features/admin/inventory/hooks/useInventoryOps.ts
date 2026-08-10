'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createOpnameBulk,
  createRestockBulk,
  createWasteBulk,
  listOpnameLogs,
  listRestockLogs,
  listWasteLogs,
} from '@/lib/api/endpoints/inventory-ops'
import { queryKeys } from '@/lib/query/keys'
import type { OpnameInput, RestockInput, WasteInput } from '@/lib/types/inventory'

/**
 * Ketiga operasi mengubah `raw_materials.stock` dan/atau `cost_per_unit`,
 * sehingga daftar bahan baku **dan** HPP produk sama-sama menjadi basi.
 */
function useInvalidateStockDependents(outletId: string | null) {
  const queryClient = useQueryClient()
  return () => {
    if (!outletId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials(outletId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.products(outletId) })
  }
}

export function useCreateRestockBulk(outletId: string | null) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateStockDependents(outletId)
  return useMutation({
    mutationFn: (items: RestockInput[]) => createRestockBulk(outletId!, items),
    onSuccess: () => {
      invalidate()
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.reportRestock(outletId) })
    },
  })
}

export function useCreateWasteBulk(outletId: string | null) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateStockDependents(outletId)
  return useMutation({
    mutationFn: (items: WasteInput[]) => createWasteBulk(outletId!, items),
    onSuccess: () => {
      invalidate()
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.reportWaste(outletId) })
    },
  })
}

export function useCreateOpnameBulk(outletId: string | null) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateStockDependents(outletId)
  return useMutation({
    mutationFn: (items: OpnameInput[]) => createOpnameBulk(outletId!, items),
    onSuccess: () => {
      invalidate()
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.reportOpnames(outletId) })
    },
  })
}

export function useRestockLogs(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.reportRestock(outletId ?? ''),
    queryFn: () => listRestockLogs(outletId!),
    enabled: !!outletId,
  })
}

export function useWasteLogs(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.reportWaste(outletId ?? ''),
    queryFn: () => listWasteLogs(outletId!),
    enabled: !!outletId,
  })
}

export function useOpnameLogs(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.reportOpnames(outletId ?? ''),
    queryFn: () => listOpnameLogs(outletId!),
    enabled: !!outletId,
  })
}

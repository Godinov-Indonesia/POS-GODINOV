'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createRawMaterial,
  createRawMaterialsBulk,
  deleteRawMaterial,
  listRawMaterials,
  updateRawMaterial,
  type RawMaterialInput,
} from '@/lib/api/endpoints/raw-materials'
import { queryKeys } from '@/lib/query/keys'

export function useRawMaterials(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.rawMaterials(outletId ?? ''),
    queryFn: () => listRawMaterials(outletId!),
    enabled: !!outletId,
  })
}

function useInvalidateRawMaterials(outletId: string | null) {
  const queryClient = useQueryClient()
  return () => {
    if (!outletId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials(outletId) })
    // Produk memuat `raw_material` ter-preload di dalam resepnya, sehingga
    // perubahan HPP bahan baku membuat kalkulasi HPP produk ikut basi.
    void queryClient.invalidateQueries({ queryKey: queryKeys.products(outletId) })
  }
}

export function useCreateRawMaterial(outletId: string | null) {
  const invalidate = useInvalidateRawMaterials(outletId)
  return useMutation({
    mutationFn: (input: RawMaterialInput) => createRawMaterial(outletId!, input),
    onSuccess: invalidate,
  })
}

export function useCreateRawMaterialsBulk(outletId: string | null) {
  const invalidate = useInvalidateRawMaterials(outletId)
  return useMutation({
    mutationFn: (items: RawMaterialInput[]) => createRawMaterialsBulk(outletId!, items),
    onSuccess: invalidate,
  })
}

export function useUpdateRawMaterial(outletId: string | null) {
  const invalidate = useInvalidateRawMaterials(outletId)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Omit<RawMaterialInput, 'stock'> }) =>
      updateRawMaterial(outletId!, id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteRawMaterial(outletId: string | null) {
  const invalidate = useInvalidateRawMaterials(outletId)
  return useMutation({
    mutationFn: (id: string) => deleteRawMaterial(outletId!, id),
    onSuccess: invalidate,
  })
}

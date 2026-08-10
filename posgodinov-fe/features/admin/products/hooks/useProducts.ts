'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createProduct,
  createProductsBulk,
  deleteProduct,
  listProducts,
  updateProduct,
  type ProductInput,
} from '@/lib/api/endpoints/products'
import { queryKeys } from '@/lib/query/keys'

export function useProducts(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.products(outletId ?? ''),
    queryFn: () => listProducts(outletId!),
    enabled: !!outletId,
  })
}

function useInvalidateProducts(outletId: string | null) {
  const queryClient = useQueryClient()
  return () => {
    if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.products(outletId) })
  }
}

export function useCreateProduct(outletId: string | null) {
  const invalidate = useInvalidateProducts(outletId)
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(outletId!, input),
    onSuccess: invalidate,
  })
}

export function useCreateProductsBulk(outletId: string | null) {
  const invalidate = useInvalidateProducts(outletId)
  return useMutation({
    mutationFn: (items: ProductInput[]) => createProductsBulk(outletId!, items),
    onSuccess: invalidate,
  })
}

export function useUpdateProduct(outletId: string | null) {
  const invalidate = useInvalidateProducts(outletId)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInput }) =>
      updateProduct(outletId!, id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteProduct(outletId: string | null) {
  const invalidate = useInvalidateProducts(outletId)
  return useMutation({
    mutationFn: (id: string) => deleteProduct(outletId!, id),
    onSuccess: invalidate,
  })
}

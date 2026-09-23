'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCategoriesBulk,
  createCategory,
  listCategories,
} from '@/lib/api/endpoints/categories'
import { queryKeys } from '@/lib/query/keys'
import type { CreateCategoryRequest } from '@/lib/types/api'

/**
 * ⚠️ `enabled: !!outletId` wajib pada setiap query ber-scope outlet:
 * `activeOutletId` bernilai `null` pada render pertama sebelum `localStorage`
 * terbaca ([05 §1.2.2]).
 */
export function useCategories(outletId: string | null) {
  return useQuery({
    queryKey: queryKeys.categories(outletId ?? ''),
    queryFn: () => listCategories(outletId!),
    enabled: !!outletId,
  })
}

export function useCreateCategory(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCategoryRequest) => createCategory(outletId!, body),
    onSuccess: () => {
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.categories(outletId) })
    },
  })
}

export function useCreateCategoriesBulk(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: CreateCategoryRequest[]) => createCategoriesBulk(outletId!, items),
    onSuccess: () => {
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.categories(outletId) })
    },
  })
}

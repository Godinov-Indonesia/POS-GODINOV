'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  approveSOForm,
  closeSOForm,
  createSOForm,
  getSOFormDetail,
  listSOForms,
  publishSOForm,
  recountSOForm,
  rejectSOForm,
  updateSOFormItems,
} from '@/lib/api/endpoints/so-forms'
import { queryKeys } from '@/lib/query/keys'
import type { CreateSOFormInput, SOStatus } from '@/lib/types/inventory'

export function useSOForms(outletId: string | null, status?: SOStatus) {
  return useQuery({
    queryKey: queryKeys.soForms(outletId ?? '', status),
    queryFn: () => listSOForms(outletId!, status),
    enabled: !!outletId,
  })
}

export function useSOFormDetail(outletId: string | null, formId: string | null) {
  return useQuery({
    queryKey: queryKeys.soFormDetail(outletId ?? '', formId ?? ''),
    queryFn: () => getSOFormDetail(outletId!, formId!),
    enabled: !!outletId && !!formId,
  })
}

export function useCreateSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSOFormInput) => createSOForm(outletId!, input),
    onSuccess: () => {
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.outletScope(outletId) })
    },
  })
}

export function useUpdateSOFormItems(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, rawMaterialIds }: { formId: string; rawMaterialIds: string[] }) =>
      updateSOFormItems(outletId!, formId, rawMaterialIds),
    onSuccess: (_, { formId }) => {
      if (outletId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.soFormDetail(outletId, formId) })
      }
    },
  })
}

export function usePublishSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => publishSOForm(outletId!, formId),
    onSuccess: (_, formId) => {
      if (outletId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.soFormDetail(outletId, formId) })
      }
    },
  })
}

export function useCloseSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => closeSOForm(outletId!, formId),
    onSuccess: (_, formId) => {
      if (outletId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.soFormDetail(outletId, formId) })
      }
    },
  })
}

export function useApproveSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => approveSOForm(outletId!, formId),
    onSuccess: (_, formId) => {
      if (outletId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.soFormDetail(outletId, formId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.products(outletId) })
      }
    },
  })
}

export function useRejectSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => rejectSOForm(outletId!, formId),
    onSuccess: (_, formId) => {
      if (outletId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.soFormDetail(outletId, formId) })
      }
    },
  })
}

export function useRecountSOForm(outletId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => recountSOForm(outletId!, formId),
    onSuccess: () => {
      if (outletId) void queryClient.invalidateQueries({ queryKey: queryKeys.soForms(outletId) })
    },
  })
}

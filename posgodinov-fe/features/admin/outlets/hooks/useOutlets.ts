'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createOutlet, listOutlets } from '@/lib/api/endpoints/outlets'
import { useSessionStore } from '@/lib/auth/session-store'
import { queryKeys } from '@/lib/query/keys'
import type { CreateOutletRequest, Outlet } from '@/lib/types/api'

export function useOutlets() {
  return useQuery({ queryKey: queryKeys.outlets(), queryFn: listOutlets })
}

export function useActiveOutletId(): string | null {
  return useSessionStore((s) => s.activeOutletId)
}

export function useActiveOutlet(): Outlet | null {
  const activeOutletId = useActiveOutletId()
  const { data } = useOutlets()
  return data?.find((o) => o.id === activeOutletId) ?? null
}

export function useCreateOutlet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateOutletRequest) => createOutlet(body),
    onSuccess: (outlet) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outlets() })
      // Outlet pertama langsung menjadi aktif; tanpa ini pengguna mendarat di
      // Dashboard yang seluruh query-nya `enabled: false`.
      if (!useSessionStore.getState().activeOutletId) {
        useSessionStore.getState().setActiveOutlet(outlet.id)
      }
    },
  })
}

/**
 * Pergantian outlet — docs/05 §1.2.2.
 *
 * `removeQueries`, **bukan** `invalidateQueries`: invalidate menyisakan data
 * lama sebagai `data` sementara refetch berjalan, sehingga pengguna melihat
 * angka outlet sebelumnya selama beberapa ratus milidetik. Pada aplikasi yang
 * menampilkan uang, itu bukan kedipan kosmetik — itu angka yang salah.
 */
export function useOutletSwitcher() {
  const queryClient = useQueryClient()

  return (nextOutletId: string) => {
    const previous = useSessionStore.getState().activeOutletId
    if (previous === nextOutletId) return

    if (previous) {
      queryClient.removeQueries({ queryKey: queryKeys.outletScope(previous) })
    }
    useSessionStore.getState().setActiveOutlet(nextOutletId)
  }
}

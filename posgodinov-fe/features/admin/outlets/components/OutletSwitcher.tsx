'use client'

import { Store } from 'lucide-react'
import * as React from 'react'

import { Select } from '@/components/ui/input'
import { useActiveOutletId, useOutletSwitcher, useOutlets } from '@/features/admin/outlets/hooks/useOutlets'

/**
 * Outlet Switcher global — docs/04 §B.2, docs/06 §3.8.
 *
 * Bersifat global dan berada di header: seluruh halaman ber-scope outlet
 * membaca `activeOutletId`, dan mengubahnya membuang seluruh cache scope
 * sebelumnya (lihat `useOutletSwitcher`).
 */
export function OutletSwitcher() {
  const { data: outlets, isPending } = useOutlets()
  const activeOutletId = useActiveOutletId()
  const switchOutlet = useOutletSwitcher()

  if (isPending) {
    return <div className="h-touch w-56 animate-pulse rounded-md bg-bg-muted" aria-hidden="true" />
  }

  if (!outlets?.length) return null

  return (
    <label className="flex items-center gap-2">
      <Store className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
      <span className="sr-only">Outlet aktif</span>
      <Select
        value={activeOutletId ?? ''}
        onChange={(e) => switchOutlet(e.target.value)}
        className="w-56"
      >
        {activeOutletId === null ? <option value="">Pilih outlet…</option> : null}
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </Select>
    </label>
  )
}

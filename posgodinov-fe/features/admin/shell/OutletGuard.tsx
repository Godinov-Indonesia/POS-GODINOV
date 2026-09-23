'use client'

import { Store } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { useActiveOutletId } from '@/features/admin/outlets/hooks/useOutlets'

/**
 * Penjaga untuk halaman ber-scope outlet.
 *
 * Seluruh modul kategori, produk, bahan baku, dan laporan memerlukan
 * `activeOutletId`. Tanpa penjaga ini, halaman-halaman tersebut merender tabel
 * kosong yang membaca seperti "tidak ada data" padahal sebenarnya "belum
 * memilih outlet" — dua kondisi yang sangat berbeda.
 */
export function OutletGuard({ children }: { children: (outletId: string) => React.ReactNode }) {
  const outletId = useActiveOutletId()

  if (!outletId) {
    return (
      <EmptyState
        icon={Store}
        title="Belum ada outlet aktif"
        description="Pilih outlet pada pemilih di header, atau buat outlet baru bila bisnis Anda belum memilikinya."
        action={
          <Link href="/admin/outlets" className={buttonVariants({ variant: 'primary' })}>
            Kelola Outlet
          </Link>
        }
      />
    )
  }

  return <>{children(outletId)}</>
}

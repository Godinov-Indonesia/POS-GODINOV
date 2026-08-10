'use client'

import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Banner } from '@/components/ui/feedback'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/features/admin/shell/PageHeader'

type Step = { title: string; description: string; href: string }

/**
 * Checklist urutan setup — docs/04 §B.3.
 *
 * Urutannya bukan preferensi melainkan ketergantungan data: produk memerlukan
 * bahan baku (untuk BOM) dan kategori; keduanya memerlukan outlet; kasir
 * memerlukan staff. Menyalahi urutan ini menghasilkan form yang tidak dapat
 * diselesaikan.
 */
const STEPS: Step[] = [
  {
    title: '1. Buat outlet',
    description:
      'Wadah bagi seluruh data lain. Catat serial_tenant-nya — teknisi membutuhkannya untuk memasang perangkat kasir.',
    href: '/admin/outlets/new',
  },
  {
    title: '2. Daftarkan staff',
    description: 'Akun kasir beserta PIN. PIN tidak dapat diubah setelah dibuat.',
    href: '/admin/staff/new',
  },
  {
    title: '3. Buat kategori produk',
    description:
      'Kategori bersifat per-outlet dan tidak dapat diubah atau dihapus. Periksa penulisan sebelum menyimpan.',
    href: '/admin/categories',
  },
  {
    title: '4. Masukkan bahan baku',
    description:
      'Tentukan base unit dan stok awal. Setelah ini, stok hanya berubah lewat restock, waste, opname, atau sinkronisasi POS.',
    href: '/admin/inventory/new',
  },
  {
    title: '5. Buat produk beserta resep (BOM)',
    description:
      'Resep menghubungkan produk ke bahan baku, dan itulah dasar pemotongan stok otomatis saat transaksi kasir tersinkronisasi.',
    href: '/admin/products/new',
  },
]

export function OnboardingChecklist() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Panduan Setup"
        description="Urutan pengisian data yang wajib diikuti agar seluruh modul berfungsi."
      />

      <Banner tone="warning">
        Urutan ini adalah ketergantungan data, bukan saran. Membuat produk sebelum bahan baku
        tersedia membuat penyusun resep kosong, dan stok tidak akan terpotong saat transaksi
        tersinkronisasi.
      </Banner>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-4">
          {STEPS.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="flex min-h-touch items-start gap-3 rounded-lg p-3 hover:bg-bg-muted"
            >
              {index === 0 ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-pos-base font-semibold text-fg">{step.title}</span>
                <span className="text-pos-sm text-fg-muted">{step.description}</span>
              </span>
              <ArrowRight className="mt-1 ml-auto size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

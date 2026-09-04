'use client'

import {
  Boxes,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Minus,
  Package,
  Plus,
  Receipt,
  Store,
  Tags,
  Trash2,
  Upload,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavGroup = { title?: string; items: NavItem[] }

/**
 * Navigasi Admin — docs/06 §3.8.
 *
 * Urutan grup mengikuti urutan setup yang wajib ([04 §B.3]): outlet → staff →
 * kategori → bahan baku → produk. Menu yang endpoint-nya tidak ada tidak
 * dimunculkan sama sekali ([05 §3.5]).
 */
const NAV: NavGroup[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/outlets', label: 'Outlet', icon: Store },
      { href: '/admin/staff', label: 'Staff', icon: Users },
    ],
  },
  {
    title: 'Produk',
    items: [
      { href: '/admin/categories', label: 'Kategori', icon: Tags },
      { href: '/admin/products', label: 'Produk', icon: Package },
      { href: '/admin/products/import', label: 'Impor Massal', icon: Upload },
    ],
  },
  {
    title: 'Inventaris',
    items: [
      { href: '/admin/inventory', label: 'Bahan Baku', icon: Boxes },
      { href: '/admin/inventory/restock', label: 'Restock', icon: Plus },
      { href: '/admin/inventory/waste', label: 'Waste', icon: Minus },
      { href: '/admin/inventory/opname', label: 'Opname', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Laporan',
    items: [
      { href: '/admin/reports/transactions', label: 'Transaksi', icon: Receipt },
      // Butir 9 — satu-satunya layar yang menampilkan selisih kas ([11 §M15.3]).
      { href: '/admin/reports/shift-reconciliation', label: 'Rekonsiliasi Shift', icon: Wallet },
      { href: '/admin/reports/restock', label: 'Restock', icon: FileBarChart },
      { href: '/admin/reports/waste', label: 'Waste', icon: Trash2 },
      { href: '/admin/reports/opname', label: 'Opname', icon: ClipboardCheck },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-surface-inverse text-fg-inverse lg:flex">
      <div className="flex h-16 items-center px-5 text-pos-lg font-bold tracking-tight">
        POS GODINOV
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((group, groupIndex) => (
          <div key={group.title ?? groupIndex} className="mb-4">
            {group.title ? (
              <p className="border-t border-border-inverse px-2 pb-2 pt-4 text-pos-xs font-semibold uppercase tracking-wide text-fg-inverse/55">
                {group.title}
              </p>
            ) : null}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        // Target 48px penuh walau ikon hanya 20px ([06 §2.1]).
                        'flex min-h-touch items-center gap-3 rounded-md px-3 text-pos-sm',
                        active
                          ? 'border-l-[3px] border-accent bg-accent-subtle pl-[9px] font-semibold text-accent'
                          : 'text-fg-inverse/80 hover:bg-fg-inverse/10 hover:text-fg-inverse',
                      )}
                    >
                      <item.icon className="size-5 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

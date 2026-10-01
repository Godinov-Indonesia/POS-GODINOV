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
  X,
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
      { href: '/admin/reports/shift-reconciliation', label: 'Rekonsiliasi Shift', icon: Wallet },
      { href: '/admin/reports/restock', label: 'Restock', icon: FileBarChart },
      { href: '/admin/reports/waste', label: 'Waste', icon: Trash2 },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AdminSidebarProps {
  isMobileOpen: boolean
  isDesktopOpen: boolean
  onCloseMobile: () => void
  onToggleDesktop: () => void
}

export function AdminSidebar({
  isMobileOpen,
  isDesktopOpen,
  onCloseMobile,
  onToggleDesktop,
}: AdminSidebarProps) {
  const pathname = usePathname()

  // Tutup drawer di layar mobile/tab saat menekan Escape
  React.useEffect(() => {
    if (!isMobileOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobileOpen, onCloseMobile])

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onCloseMobile()
    }
  }

  return (
    <>
      {/* Backdrop semi-transparan untuk tampilan mobile / tablet (tab) */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col bg-surface-inverse text-fg-inverse transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:transition-none',
          // Tampilan tab & mobile (drawer overlay)
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          // Tampilan desktop (fixed in flex flow)
          isDesktopOpen ? 'lg:flex lg:translate-x-0' : 'lg:hidden',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <span className="text-pos-lg font-bold tracking-tight">POS GODINOV</span>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                onCloseMobile()
              } else {
                onToggleDesktop()
              }
            }}
            className="flex size-8 items-center justify-center rounded-md text-fg-inverse/70 transition-colors hover:bg-fg-inverse/10 hover:text-fg-inverse"
            aria-label="Tutup menu sidebar"
            title="Tutup menu sidebar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
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
                        onClick={handleLinkClick}
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
    </>
  )
}

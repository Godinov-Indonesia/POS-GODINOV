'use client'

import {
  Boxes,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Minus,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
  /** Drawer overlay mobile/tablet (< 1024px) — ditutup/dibuka lewat hamburger di header. */
  isMobileOpen: boolean
  /** Rail ikon desktop (≥ 1024px) — sidebar tidak pernah hilang total, hanya menyusut. */
  isCollapsed: boolean
  onCloseMobile: () => void
  onToggleCollapse: () => void
}

export function AdminSidebar({
  isMobileOpen,
  isCollapsed,
  onCloseMobile,
  onToggleCollapse,
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
          className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col bg-surface-inverse text-fg-inverse transition-transform duration-200 ease-in-out',
          // Tampilan tab & mobile (drawer overlay)
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          // Tampilan desktop: panel statis dalam flex flow, lebar bertransisi
          // mulus antara penuh (256px) dan rail ikon (72px) — tidak pernah
          // `hidden` total agar jejak navigasi tetap terlihat ([06 §2.1]).
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-in-out',
          isCollapsed ? 'lg:w-18' : 'lg:w-64',
        )}
      >
        {/* Tombol collapse — baris sendiri dengan label teks saat terbuka
            (lebih jelas niatnya daripada ikon polos), menyusut jadi ikon
            saja saat rail ikon ([06 §2.1]). Posisi di atas, bukan footer,
            agar lebih mudah ditemukan saat scanning UI. */}
        <div className="hidden border-b border-border-inverse p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
            title={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
            className={cn(
              'flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-pos-sm text-fg-inverse/70',
              'hover:bg-fg-inverse/10 hover:text-fg-inverse',
              isCollapsed && 'justify-center px-0',
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5 shrink-0" aria-hidden="true" />
            )}
            <span className={cn(isCollapsed && 'hidden')}>Perkecil Sidebar</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {NAV.map((group, groupIndex) => (
            <div key={group.title ?? groupIndex} className="mb-4">
              {group.title ? (
                <p
                  className={cn(
                    'border-t border-border-inverse px-2 pb-2 pt-4 text-pos-xs font-semibold uppercase tracking-wide text-fg-inverse/55 whitespace-nowrap',
                    isCollapsed && 'lg:hidden',
                  )}
                >
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
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          // Target 48px penuh walau ikon hanya 20px ([06 §2.1]).
                          'flex min-h-touch items-center gap-3 rounded-md px-3 text-pos-sm whitespace-nowrap',
                          active
                            ? isCollapsed
                              // Rail ikon: border kiri tak muat rapi saat center, pakai fill saja.
                              ? 'lg:justify-center bg-accent-subtle font-semibold text-accent lg:border-l-0 lg:pl-0 lg:px-0 border-l-[3px] border-accent pl-[9px]'
                              : 'border-l-[3px] border-accent bg-accent-subtle pl-[9px] font-semibold text-accent'
                            : cn(
                                'text-fg-inverse/80 hover:bg-fg-inverse/10 hover:text-fg-inverse',
                                isCollapsed && 'lg:justify-center lg:px-0',
                              ),
                        )}
                      >
                        <item.icon className="size-5 shrink-0" aria-hidden="true" />
                        <span className={cn(isCollapsed && 'lg:hidden')}>{item.label}</span>
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

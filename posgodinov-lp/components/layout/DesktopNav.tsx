import * as React from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/content/types";

export interface DesktopNavProps {
  navItems: readonly NavItem[];
}

export function DesktopNav({ navItems }: DesktopNavProps) {
  return (
    <nav
      className="hidden md:flex items-center gap-0.5 rounded-full border border-ink-800/80 bg-ink-900/40 p-1 backdrop-blur-sm"
      aria-label="Navigasi Utama"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full px-4 py-1.5 text-sm lg:text-[15px] font-medium text-paper-50/70 hover:text-paper-50 hover:bg-ink-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

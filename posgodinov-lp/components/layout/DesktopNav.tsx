import * as React from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/content/types";

export interface DesktopNavProps {
  navItems: readonly NavItem[];
}

export function DesktopNav({ navItems }: DesktopNavProps) {
  return (
    <nav
      className="hidden md:flex items-center gap-1 lg:gap-2"
      aria-label="Navigasi Utama"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-paper-50/70 hover:text-paper-50 hover:bg-ink-900/60 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

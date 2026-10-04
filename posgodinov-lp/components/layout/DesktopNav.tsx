import * as React from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/content/types";

export interface DesktopNavProps {
  navItems: readonly NavItem[];
}

export function DesktopNav({ navItems }: DesktopNavProps) {
  return (
    <nav
      className="hidden md:flex items-center gap-2 lg:gap-3"
      aria-label="Navigasi Utama"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg px-3.5 py-2 text-[15px] lg:text-base font-medium text-paper-50/80 hover:text-paper-50 hover:bg-ink-900/70 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

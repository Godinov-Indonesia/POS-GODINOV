"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteContent, type NavItem } from "@/lib/content";

export function MobileNav({ navItems }: { navItems: readonly NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            data-testid="mobile-menu-trigger"
            aria-label="Buka menu navigasi"
            className="p-2 text-paper-50 hover:bg-ink-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Menu className="h-6 w-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="flex flex-col justify-between">
          <div>
            <SheetHeader className="mb-6 pb-4 border-b border-ink-800">
              <SheetTitle>
                <Image
                  src="/images/logo-transparent.webp"
                  alt="Godinov POS"
                  width={130}
                  height={37}
                  className="h-7 w-auto object-contain"
                />
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col space-y-3" aria-label="Navigasi Mobile">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-base font-medium text-paper-50/80 hover:bg-ink-900 hover:text-paper-50 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-ink-800 pt-6">
            <Link
              href={siteContent.header.loginHref}
              onClick={close}
              className="flex w-full items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/10 py-3 text-center text-sm font-semibold text-brand-500 hover:bg-brand-500/20 transition-colors"
            >
              {siteContent.header.loginText}
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

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
import { Button } from "@/components/ui/button";
import { siteContent, type NavItem } from "@/lib/content";

export function MobileNav({ navItems }: { navItems: readonly NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            data-testid="mobile-menu-trigger"
            aria-label="Buka menu navigasi"
            className="text-paper-50"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex flex-col justify-between">
          <div>
            <SheetHeader className="mb-6 pb-4 border-b border-ink-800">
              <SheetTitle className="flex items-center gap-2">
                <Image
                  src="/images/logo-transparent.webp"
                  alt="Godinov POS"
                  width={130}
                  height={37}
                  className="h-7 w-auto object-contain"
                />
                <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-brand-300">
                  {siteContent.brand.version}
                </span>
              </SheetTitle>
              <div className="flex items-center gap-2 text-xs font-mono text-brand-300/90 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {siteContent.header.offlineBadge}
              </div>
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

          <div className="border-t border-ink-800 pt-6 space-y-3">
            <Button asChild variant="outline" className="w-full justify-center" onClick={close}>
              <Link href={siteContent.header.loginHref}>{siteContent.header.loginText}</Link>
            </Button>
            <Button asChild className="w-full justify-center bg-brand-500 text-ink-950 hover:bg-brand-400 font-bold" onClick={close}>
              <Link href={siteContent.header.ctaHref}>{siteContent.header.ctaText}</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

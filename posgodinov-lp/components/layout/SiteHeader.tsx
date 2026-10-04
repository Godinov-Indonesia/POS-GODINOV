"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { siteContent } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY >= 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-testid="site-header"
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-200",
        isScrolled
          ? "border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-md shadow-lg shadow-black/20"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
            aria-label="Godinov POS V2 Beranda"
          >
            <Image
              src="/images/logo-transparent.webp"
              alt="Godinov POS"
              width={140}
              height={40}
              priority
              className="h-8 sm:h-9 w-auto object-contain"
            />
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-brand-300 border border-brand-500/20">
              {siteContent.brand.version}
            </span>
          </Link>

          <div
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/5 px-2.5 py-0.5 text-[11px] font-mono text-brand-300"
            title="Sistem kasir tetap beroperasi penuh tanpa koneksi internet"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>{siteContent.header.offlineBadge}</span>
          </div>
        </div>

        <DesktopNav navItems={siteContent.header.navItems} />

        <div className="flex items-center gap-3">
          <Link
            href={siteContent.header.loginHref}
            className="hidden sm:inline-flex text-sm font-medium text-paper-50/80 hover:text-paper-50 px-3 py-2 rounded-md hover:bg-ink-900/60 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {siteContent.header.loginText}
          </Link>

          <Button
            asChild
            size="sm"
            data-testid="site-header-cta"
            className="bg-brand-500 text-ink-950 hover:bg-brand-400 font-bold"
          >
            <Link href={siteContent.header.ctaHref}>
              {siteContent.header.ctaText}
            </Link>
          </Button>

          <MobileNav navItems={siteContent.header.navItems} />
        </div>
      </div>
    </header>
  );
}

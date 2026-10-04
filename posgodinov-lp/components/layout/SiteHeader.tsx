"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { siteContent } from "@/lib/content";
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
        <Link
          href="/"
          className="flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
          aria-label="Godinov POS Beranda"
        >
          <Image
            src="/images/logo-transparent.webp"
            alt="Godinov POS"
            width={140}
            height={40}
            priority
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </Link>

        <DesktopNav navItems={siteContent.header.navItems} />

        <div className="flex items-center gap-3">
          <Link
            href={siteContent.header.loginHref}
            className="text-sm font-semibold text-brand-500 hover:text-brand-400 px-3.5 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {siteContent.header.loginText}
          </Link>

          <MobileNav navItems={siteContent.header.navItems} />
        </div>
      </div>
    </header>
  );
}

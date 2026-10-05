"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { BrandLogo } from "@/components/common/BrandLogo";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
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
      <div className="relative mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
          aria-label="Godinov POS Beranda"
        >
          <BrandLogo
            width={165}
            height={48}
            priority
            className="h-8 sm:h-9 md:h-10 w-auto object-contain"
          />
        </Link>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <DesktopNav navItems={siteContent.header.navItems} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <Link
            href={siteContent.header.loginHref}
            className="hidden lg:inline-flex text-sm font-medium text-paper-50/80 hover:text-paper-50 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {siteContent.header.loginText}
          </Link>

          <Button asChild size="sm" className="hidden md:inline-flex font-semibold">
            <Link href={siteContent.header.ctaHref} className="flex items-center gap-1.5">
              <span>{siteContent.header.ctaText}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <MobileNav navItems={siteContent.header.navItems} />
        </div>
      </div>
    </header>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { siteContent } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY >= 24);
    };

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
        {/* Brand & Offline Teaser Badge */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-mono text-sm font-bold text-ink-950 shadow-sm transition-transform group-hover:scale-105">
              G
            </div>
            <span className="font-bold tracking-tight text-paper-50 sm:text-lg">
              {siteContent.brand.name}
            </span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-brand-300 border border-brand-500/20">
              {siteContent.brand.version}
            </span>
          </Link>

          {/* Teaser Feature: Offline-First live pill */}
          <div
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/5 px-2.5 py-0.5 text-[11px] font-mono text-brand-300"
            title="Sistem kasir tetap beroperasi penuh tanpa koneksi internet"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            <span>{siteContent.header.offlineBadge}</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-1 lg:gap-2"
          aria-label="Navigasi Utama"
        >
          {siteContent.header.navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-paper-50/70 hover:text-paper-50 hover:bg-ink-900/60 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions & Mobile Nav */}
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
            className="bg-brand-500 text-ink-950 hover:bg-brand-300 font-semibold"
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

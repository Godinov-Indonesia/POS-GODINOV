"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { siteContent, type NavItem } from "@/lib/content";

export function MobileNav({ navItems }: { navItems: readonly NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        data-testid="mobile-menu-trigger"
        aria-label="Buka menu navigasi"
        onClick={() => setOpen(true)}
        className="p-2 text-paper-50 hover:bg-ink-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu Navigasi"
            className="relative z-10 flex h-full w-3/4 max-w-sm flex-col justify-between border-l border-ink-800 bg-ink-950 p-6 shadow-2xl"
          >
            <div>
              <div className="mb-6 flex items-center justify-between pb-4 border-b border-ink-800">
                <Image
                  src="/images/logo-transparent.webp"
                  alt="Godinov POS"
                  width={130}
                  height={37}
                  className="h-7 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Tutup menu"
                  className="rounded-md p-1.5 text-paper-50/70 hover:text-paper-50 hover:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

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
          </div>
        </div>
      )}
    </div>
  );
}

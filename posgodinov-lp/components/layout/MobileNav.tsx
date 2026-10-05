"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, HelpCircle, LayoutGrid, Tag, type LucideIcon } from "lucide-react";
import { siteContent, type NavItem } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, LucideIcon> = {
  "#fitur": LayoutGrid,
  "#harga": Tag,
  "#faq": HelpCircle,
};

const listVariants: Variants = {
  open: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  closed: {},
};

const itemVariants: Variants = {
  open: { opacity: 1, x: 0 },
  closed: { opacity: 0, x: 16 },
};

export function MobileNav({ navItems }: { navItems: readonly NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const close = () => setOpen(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safety flag so the portal only targets document.body on the client
    setMounted(true);
  }, []);

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
        aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-ink-800 bg-ink-900/60 text-paper-50/80 shadow-sm transition-colors hover:border-brand-500/40 hover:bg-ink-900 hover:text-paper-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex w-[18px] flex-col items-end gap-[5px]">
          <span
            className={cn(
              "h-[2px] rounded-full bg-current transition-all duration-300",
              open ? "w-[18px] translate-y-[7px] rotate-45" : "w-[18px]"
            )}
          />
          <span
            className={cn(
              "h-[2px] rounded-full bg-current transition-all duration-300",
              open ? "w-0 opacity-0" : "w-[10px]"
            )}
          />
          <span
            className={cn(
              "h-[2px] rounded-full bg-current transition-all duration-300",
              open ? "w-[18px] -translate-y-[7px] -rotate-45" : "w-[14px]"
            )}
          />
        </span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                key="mobile-nav-overlay"
                className="fixed inset-x-0 bottom-0 top-16 sm:top-20 z-50 flex justify-end isolate"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-x-0 bottom-0 top-16 sm:top-20 bg-black/85"
                  onClick={close}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 32, stiffness: 320 }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu Navigasi"
                  className="relative z-10 flex h-full w-3/4 max-w-sm flex-col justify-between border-l border-ink-800 bg-ink-950 p-6 shadow-2xl will-change-transform"
                >
                  <div>
                    <motion.nav
                      initial="closed"
                      animate="open"
                      variants={listVariants}
                      className="flex flex-col space-y-1.5"
                      aria-label="Navigasi Mobile"
                    >
                      {navItems.map((item) => {
                        const Icon = NAV_ICONS[item.href];
                        return (
                          <motion.div key={item.href} variants={itemVariants}>
                            <Link
                              href={item.href}
                              onClick={close}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-paper-50/80 hover:bg-ink-900 hover:text-paper-50 transition-colors"
                            >
                              {Icon && (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
                                  <Icon className="h-4 w-4" />
                                </span>
                              )}
                              <span>{item.label}</span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </motion.nav>
                  </div>

                  <div className="space-y-3 border-t border-ink-800 pt-6">
                    <Button asChild size="lg" className="w-full font-bold" onClick={close}>
                      <Link href={siteContent.header.ctaHref} className="flex items-center justify-center gap-2">
                        <span>{siteContent.header.ctaText}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Link
                      href={siteContent.header.loginHref}
                      onClick={close}
                      className="flex w-full items-center justify-center rounded-lg border border-ink-800 bg-ink-900/60 py-3 text-center text-sm font-semibold text-paper-50 hover:bg-ink-800 transition-colors"
                    >
                      {siteContent.header.loginText}
                    </Link>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

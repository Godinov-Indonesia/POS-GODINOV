"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function PagePreloader({ minDisplayMs = 750 }: { minDisplayMs?: number }) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, minDisplayMs);

    return () => clearTimeout(timeout);
  }, [minDisplayMs]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="page-preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-ink-950 select-none"
          style={{ backgroundColor: "#0B061A" }}
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center justify-center">
            <div className="animate-pulse">
              <Image
                src="/images/logo-transparent.webp"
                alt="Godinov POS"
                width={180}
                height={52}
                priority
                className="h-11 sm:h-12 w-auto object-contain drop-shadow-[0_0_24px_rgba(0,255,209,0.35)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

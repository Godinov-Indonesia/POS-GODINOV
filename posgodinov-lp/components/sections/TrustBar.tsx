import * as React from "react";
import { siteContent } from "@/lib/content";

export function TrustBar() {
  const { trustBar } = siteContent;

  return (
    <section
      data-testid="trust-bar"
      className="border-y border-ink-800/80 bg-ink-900/40 py-10"
      aria-label="Metrik dan Pengguna"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center pb-8 border-b border-ink-800/60">
          {trustBar.metrics.map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="text-3xl lg:text-4xl font-mono font-bold tracking-tight text-brand-500 tabular-nums">
                {m.value}
              </div>
              <div className="text-xs uppercase tracking-wider text-paper-50/60 font-mono">
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* TODO: ganti dengan logo klien asli saat peluncuran publik */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 opacity-40 grayscale">
          {trustBar.clientsPlaceholder.map((c) => (
            <div
              key={c.id}
              className="text-xs font-mono font-medium tracking-wider uppercase border border-ink-800 px-3 py-1.5 rounded bg-ink-950/60"
            >
              {c.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

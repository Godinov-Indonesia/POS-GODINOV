import * as React from "react";
import { cn } from "@/lib/utils";

export interface BentoCellProps {
  slug: string;
  title: string;
  description: string;
  spanDesktop: number;
  tone?: "default" | "brand" | "signal";
  badge?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const spanMap: Record<number, string> = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  12: "lg:col-span-12",
};

export function BentoCell({
  slug,
  title,
  description,
  spanDesktop,
  tone = "default",
  badge,
  icon,
  children,
}: BentoCellProps) {
  return (
    <article
      data-testid={`bento-cell-${slug}`}
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-6 sm:p-8 transition-colors col-span-12",
        spanMap[spanDesktop] ?? "lg:col-span-6",
        tone === "brand"
          ? "border-brand-500/40 bg-ink-900/90 ring-1 ring-brand-500/20"
          : "border-ink-800 bg-ink-900/60 hover:border-ink-700"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          {icon && <div className="text-brand-500">{icon}</div>}
          {badge && (
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 border border-brand-500/30 bg-brand-500/10 text-brand-500">
              {badge}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-paper-50 tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-sm text-paper-50/70 leading-relaxed">
          {description}
        </p>
      </div>

      {children && <div className="mt-6 pt-4 border-t border-ink-800/60">{children}</div>}
    </article>
  );
}

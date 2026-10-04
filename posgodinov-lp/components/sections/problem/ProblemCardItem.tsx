"use client";

import * as React from "react";
import type { ProblemCard } from "@/lib/content/types";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import countingMoneyAnimation from "@/public/icons/countingmoney.json";
import networklessAnimation from "@/public/icons/networkless.json";
import { AlertCircle, FileX, WifiOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<number, LucideIcon> = {
  1: AlertCircle,
  2: FileX,
  3: WifiOff,
};

export function ProblemCardItem({ card }: { card: ProblemCard }) {
  const IconComp = ICONS[card.id] ?? AlertCircle;

  return (
    <article
      data-testid={`problem-card-${card.id}`}
      className={cn(
        "relative flex flex-col justify-between rounded-xl border border-ink-800 bg-ink-900/60 p-6 shadow-sm border-l-2 border-l-alert-500/60",
        card.id === 3 ? "overflow-visible mt-6 md:mt-0" : "overflow-hidden"
      )}
    >
      {card.id === 1 && (
        <div className="pointer-events-none absolute -bottom-2 -left-2 w-32 h-32 sm:w-36 sm:h-36 z-0 opacity-75" aria-hidden="true">
          <LottiePlayer animationData={countingMoneyAnimation} className="h-full w-full" />
        </div>
      )}

      {card.id === 3 && (
        <div
          className="pointer-events-none absolute -top-14 right-2 sm:-top-16 sm:right-3 w-28 h-28 sm:w-32 sm:h-32 z-20 opacity-90"
          aria-hidden="true"
        >
          <LottiePlayer animationData={networklessAnimation} className="h-full w-full" />
        </div>
      )}

      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-2 text-alert-500">
          <IconComp className="h-5 w-5" />
          <span className="font-mono text-xs uppercase tracking-wider">
            Titik Bocor #{card.id}
          </span>
        </div>
        <h3 className="text-lg font-bold text-paper-50 tracking-tight">{card.title}</h3>
        <p className="text-sm text-paper-50/70 leading-relaxed">{card.body}</p>
      </div>

      <div className="relative z-10 mt-6 pt-4 border-t border-ink-800/80 font-mono text-xs font-medium">
        {card.id === 1 && card.impact.startsWith("Rata-rata") ? (
          <span className="text-alert-500/90">
            <span className="text-signal-500 font-semibold">Rata-rata</span>
            {card.impact.slice("Rata-rata".length)}
          </span>
        ) : (
          <span className="text-alert-500/90">{card.impact}</span>
        )}
      </div>
    </article>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import type { PricingPlan } from "@/lib/content/types";
import { Button } from "@/components/ui/button";
import { Check, Store, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export function PricingCard({
  plan,
  isYearly,
}: {
  plan: PricingPlan;
  isYearly: boolean;
}) {
  const price = isYearly ? plan.yearlyPricePerMonth : plan.monthlyPrice;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-2xl border p-6 sm:p-8 transition-all duration-300",
        plan.highlighted
          ? "border-brand-500/60 bg-ink-900/90 shadow-2xl shadow-brand-500/10 ring-1 ring-brand-500/30"
          : "border-ink-800 bg-ink-950/70 hover:border-ink-700"
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-brand-500/50 bg-brand-500 px-3.5 py-0.5 text-xs font-bold text-ink-950 uppercase tracking-wider">
          Paling Populer
        </span>
      )}

      <div>
        <div className="flex justify-between items-baseline mb-2">
          <h3 className="text-xl font-bold text-paper-50">{plan.name}</h3>
        </div>
        <p className="text-sm text-paper-50/70 min-h-[40px] leading-relaxed mb-6">
          {plan.description}
        </p>

        <div className="mb-6 pb-6 border-b border-ink-800">
          {plan.customPrice ? (
            <div className="h-10 flex items-center">
              <Button
                asChild
                size="lg"
                className="w-full font-bold bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-md shadow-brand-500/15"
              >
                <Link href={plan.ctaHref}>{plan.ctaText}</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-mono text-paper-50/60">Rp</span>
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-paper-50 tabular-nums">
                {price?.toLocaleString("id-ID") ?? "0"}
              </span>
              <span className="text-xs font-mono text-paper-50/60">/bln</span>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs font-mono text-paper-50/70">
            <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-brand-500" />{plan.outletLimit}</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-brand-500" />{plan.deviceLimit}</span>
          </div>
        </div>

        <ul className="space-y-3 mb-8 text-sm">
          {plan.features.map((feat) => (
            <li key={feat.name} className="flex items-start gap-2.5">
              <Check className={cn("h-4 w-4 mt-0.5 shrink-0", feat.included ? "text-brand-500" : "text-paper-50/20")} />
              <span className={cn(feat.included ? "text-paper-50/90" : "text-paper-50/30 line-through")}>
                {feat.name}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!plan.customPrice && (
        <Button asChild size="lg" variant={plan.highlighted ? "default" : "outline"} className={cn("w-full font-bold", plan.highlighted ? "bg-brand-500 text-ink-950 hover:bg-brand-400" : "border-ink-800 bg-ink-900/60 text-paper-50 hover:bg-ink-800")}>
          <Link href={plan.ctaHref}>{plan.ctaText}</Link>
        </Button>
      )}
    </div>
  );
}

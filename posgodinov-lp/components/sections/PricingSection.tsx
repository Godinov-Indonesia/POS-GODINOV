"use client";

import * as React from "react";
import { siteContent } from "@/lib/content";
import { SectionShell } from "@/components/common/SectionShell";
import { PricingCard } from "./pricing/PricingCard";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const { pricing } = siteContent;
  const [isYearly, setIsYearly] = React.useState(true);

  return (
    <SectionShell
      id="harga"
      eyebrow="Investasi Transparan"
      title={pricing.heading}
      subtitle={pricing.subheading}
    >
      <div className="flex flex-col items-center mb-10">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-full border border-ink-800 bg-ink-950">
          <button
            type="button"
            onClick={() => setIsYearly(false)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-full transition-all",
              !isYearly ? "bg-ink-800 text-paper-50 shadow" : "text-paper-50/60 hover:text-paper-50"
            )}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setIsYearly(true)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all",
              isYearly ? "bg-brand-500 text-onbright shadow" : "text-paper-50/60 hover:text-paper-50"
            )}
          >
            <span>Tahunan</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase", isYearly ? "bg-onbright/20 text-onbright" : "bg-brand-500/20 text-brand-300")}>
              Hemat 20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
        {pricing.plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} isYearly={isYearly} />
        ))}
      </div>
    </SectionShell>
  );
}

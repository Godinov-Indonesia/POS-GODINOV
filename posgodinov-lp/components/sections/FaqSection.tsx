"use client";

import * as React from "react";
import { siteContent } from "@/lib/content";
import { SectionShell } from "@/components/common/SectionShell";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqSection() {
  const { faq } = siteContent;
  const [openId, setOpenId] = React.useState<string | null>("faq-1");

  return (
    <SectionShell
      id="faq"
      eyebrow="Tanya Jawab"
      title={faq.heading}
      subtitle={faq.subheading}
    >
      <div className="mx-auto max-w-3xl space-y-3">
        {faq.items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border transition-all duration-200 overflow-hidden",
                isOpen
                  ? "border-brand-500/40 bg-ink-900/90 shadow-lg"
                  : "border-ink-800 bg-ink-950/70 hover:border-ink-700"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between p-5 text-left font-semibold text-base text-paper-50"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-paper-50/50 transition-transform duration-200",
                    isOpen && "rotate-180 text-brand-500"
                  )}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-0 text-sm text-paper-50/70 leading-relaxed border-t border-ink-800/50 mt-1">
                  <p className="pt-3">{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

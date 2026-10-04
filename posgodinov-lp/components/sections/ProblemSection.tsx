import * as React from "react";
import { siteContent } from "@/lib/content";
import { SectionShell } from "@/components/common/SectionShell";
import { AlertCircle, FileX, WifiOff } from "lucide-react";

const icons = [AlertCircle, FileX, WifiOff];

export function ProblemSection() {
  const { problem } = siteContent;

  return (
    <SectionShell
      id="masalah"
      eyebrow="Kebocoran Kas Tak Terlihat"
      title={problem.heading}
      subtitle={problem.subheading}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {problem.cards.map((card, idx) => {
          const IconComp = icons[idx] ?? AlertCircle;
          return (
            <article
              key={card.id}
              data-testid={`problem-card-${card.id}`}
              className="flex flex-col justify-between rounded-xl border border-ink-800 bg-ink-900/60 p-6 shadow-sm border-l-2 border-l-alert-500/60"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-alert-500">
                  <IconComp className="h-5 w-5" />
                  <span className="font-mono text-xs uppercase tracking-wider">
                    Titik Bocor #{card.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-paper-50 tracking-tight">
                  {card.title}
                </h3>
                <p className="text-sm text-paper-50/70 leading-relaxed">
                  {card.body}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-ink-800/80 font-mono text-xs text-alert-500/90 font-medium">
                {card.impact}
              </div>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

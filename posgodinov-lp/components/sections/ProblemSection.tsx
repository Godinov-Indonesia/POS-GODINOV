import * as React from "react";
import { siteContent } from "@/lib/content";
import { SectionShell } from "@/components/common/SectionShell";
import { ProblemCardItem } from "./problem/ProblemCardItem";

export function ProblemSection() {
  const { problem } = siteContent;

  return (
    <SectionShell
      id="masalah"
      eyebrow="Kebocoran Kas Tak Terlihat"
      title={problem.heading}
      subtitle={problem.subheading}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 sm:pt-0">
        {problem.cards.map((card) => (
          <ProblemCardItem key={card.id} card={card} />
        ))}
      </div>
    </SectionShell>
  );
}


import * as React from "react";
import Link from "next/link";
import { siteContent } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";

export function FinalCtaSection() {
  const { finalCta } = siteContent;

  return (
    <section className="relative overflow-hidden py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-b from-brand-500/[0.06] to-ink-950 p-8 sm:p-12 md:p-16 text-center shadow-2xl backdrop-blur-xl dark:from-brand-purple/40">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-paper-50 leading-tight">
              {finalCta.heading}
            </h2>
            <p className="text-base sm:text-lg text-paper-50/70 leading-relaxed max-w-xl mx-auto">
              {finalCta.subheading}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto bg-brand-500 text-onbright hover:bg-brand-400 font-bold px-8 shadow-lg shadow-brand-500/20"
              >
                <Link href={finalCta.ctaPrimary.href} className="flex items-center justify-center gap-2">
                  <span>{finalCta.ctaPrimary.text}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-ink-800 bg-ink-900/80 text-paper-50 hover:bg-ink-800"
              >
                <Link href={finalCta.ctaSecondary.href} className="flex items-center justify-center gap-2">
                  <MessageCircle className="h-4 w-4 text-brand-300" />
                  <span>{finalCta.ctaSecondary.text}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

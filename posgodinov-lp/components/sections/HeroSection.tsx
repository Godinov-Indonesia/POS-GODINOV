import * as React from "react";
import Link from "next/link";
import { siteContent } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { HeroCardDeck } from "@/components/interactive/HeroCardDeck";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function HeroSection() {
  const { hero } = siteContent;

  return (
    <section
      id="beranda"
      data-testid="hero"
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-24 lg:pt-20 lg:pb-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <h1
              id="hero-title"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-paper-50 leading-[1.12]"
            >
              Kasir tetap jalan.
              <br />
              <span className="text-paper-50/80">
                Uang tidak ikut jalan-jalan.
              </span>
            </h1>

            <p className="max-w-[58ch] text-base sm:text-lg text-paper-50/70 leading-relaxed">
              {hero.subheadline}
            </p>

            {/* Dual CTA in Hero */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button
                asChild
                size="lg"
                data-testid="hero-cta-primary"
                className="bg-brand-500 text-onbright hover:bg-brand-400 font-bold text-base shadow-sm"
              >
                <Link href={hero.ctaPrimary.href} className="flex items-center justify-center gap-2">
                  <span>{hero.ctaPrimary.text}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                data-testid="hero-cta-secondary"
                className="border-ink-800 bg-ink-900/60 text-paper-50 hover:bg-ink-900"
              >
                <Link href={hero.ctaSecondary.href}>{hero.ctaSecondary.text}</Link>
              </Button>
            </div>

            <div className="pt-2 border-t border-ink-800/80 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-paper-50/60">
              {hero.microProof.map((item) => (
                <div key={item} className="flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroCardDeck />
          </div>
        </div>
      </div>
    </section>
  );
}

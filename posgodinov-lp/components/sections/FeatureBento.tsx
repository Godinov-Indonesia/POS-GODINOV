import * as React from "react";
import { siteContent } from "@/lib/content";
import { SectionShell } from "@/components/common/SectionShell";
import { BentoCell } from "@/components/common/BentoCell";
import { ShieldAlert, WifiOff, ShieldCheck, Lock, Boxes, Store, FileText } from "lucide-react";

const icons = [ShieldCheck, Lock, Boxes, Store, FileText];

export function FeatureBento() {
  const { items, heading, subheading } = siteContent.featureBento;

  return (
    <SectionShell id="fitur" eyebrow="Instrumen Kontrol Toko" title={heading} subtitle={subheading}>
      <div data-testid="feature-bento" className="grid grid-cols-12 gap-6">
        {/* Cell A: Hitung Laci Tertutup (span 7) */}
        <BentoCell slug={items[0].slug} title={items[0].title} description={items[0].description} spanDesktop={items[0].spanDesktop} badge={items[0].badge} icon={<ShieldAlert className="h-6 w-6" />}>
          <div aria-hidden="true" className="flex items-center gap-3 font-mono text-xs">
            <div className="flex-1 rounded border border-ink-800 bg-ink-950 p-2.5">
              <span className="text-[10px] text-paper-50/50 block">Kasir Input Fisik:</span>
              <span className="text-paper-50/80 font-semibold tracking-widest">••••••••</span>
            </div>
            <span className="text-paper-50/30">→</span>
            <div className="flex-1 rounded border border-brand-500/30 bg-brand-500/10 p-2.5">
              <span className="text-[10px] text-brand-500 block">Layar Pemilik Toko:</span>
              <span className="text-brand-500 font-semibold tabular-nums">Selisih: Rp 0</span>
            </div>
          </div>
        </BentoCell>

        {/* Cell B: Jalan Penuh Tanpa Internet (span 5, tone: brand) */}
        <BentoCell slug={items[1].slug} title={items[1].title} description={items[1].description} spanDesktop={items[1].spanDesktop} tone={items[1].tone} badge={items[1].badge} icon={<WifiOff className="h-6 w-6" />}>
          <div aria-hidden="true" className="flex items-center justify-between font-mono text-xs rounded border border-ink-800 bg-ink-950 p-2.5">
            <span className="flex items-center gap-1.5 text-signal-500">
              <span className="h-2 w-2 rounded-full bg-signal-500" />
              Mode Tanpa Sinyal
            </span>
            <span className="text-brand-500 tabular-nums font-semibold">12 Nota Tersimpan</span>
          </div>
        </BentoCell>

        {/* Cells C - G */}
        {items.slice(2).map((item, idx) => {
          const Icon = icons[idx];
          return (
            <BentoCell
              key={item.slug}
              slug={item.slug}
              title={item.title}
              description={item.description}
              spanDesktop={item.spanDesktop}
              icon={<Icon className="h-6 w-6" />}
            />
          );
        })}
      </div>
    </SectionShell>
  );
}

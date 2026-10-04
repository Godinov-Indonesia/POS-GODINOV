import * as React from "react";
import { ShoppingCart, Receipt } from "lucide-react";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import creditCardAnimation from "@/public/icons/creditcard.json";

export function PosCart() {
  return (
    <div className="md:col-span-7 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between border-b border-ink-800 pb-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-paper-50/80">
            <ShoppingCart className="h-3.5 w-3.5 text-brand-500" />
            Pesanan #8821
          </span>
          <span className="font-mono text-[11px] text-paper-50/50">
            19:42:08
          </span>
        </div>

        <div className="mt-3 space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center text-paper-50/90">
            <span className="truncate pr-2">2x Es Kopi Godinov</span>
            <span className="tabular-nums font-semibold">Rp 44.000</span>
          </div>
          <div className="flex justify-between items-center text-paper-50/90">
            <span className="truncate pr-2">1x Butter Croissant</span>
            <span className="tabular-nums font-semibold">Rp 28.000</span>
          </div>
          <div className="flex justify-between items-center text-paper-50/90">
            <span className="truncate pr-2">1x Cold Brew Tonic</span>
            <span className="tabular-nums font-semibold">Rp 24.000</span>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-800 pt-3">
        <div className="flex justify-between items-baseline mb-3">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 shrink-0 overflow-hidden">
              <LottiePlayer animationData={creditCardAnimation} className="h-full w-full" />
            </div>
            <span className="text-xs uppercase tracking-wider text-paper-50/60 font-mono">
              Total
            </span>
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-brand-500 tabular-nums">
            Rp 96.000
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 font-bold text-ink-950 hover:bg-brand-400 transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            Bayar Tunai
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950 py-2 font-medium text-paper-50/80 hover:bg-ink-800 transition-colors"
          >
            Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}

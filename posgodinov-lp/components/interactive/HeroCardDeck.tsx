"use client";

import * as React from "react";
import { PosDeviceMock } from "./PosDeviceMock";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import storeBuildingAnimation from "@/public/icons/storebuilding.json";
import graphicSalesAnimation from "@/public/icons/graphicsales.json";

export function HeroCardDeck() {
  return (
    <div className="relative mx-auto w-full max-w-xl pt-12 sm:pt-14 group">
      {/* Kartu Kiri (Belakang): Multi Cabang */}
      <div
        className="absolute top-0 left-2 sm:-left-4 z-0 w-52 sm:w-64 -rotate-3 sm:-rotate-6 rounded-2xl border border-ink-800/90 bg-ink-950/95 p-3 sm:p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 group-hover:-translate-x-3 group-hover:-translate-y-2 group-hover:-rotate-8 hover:!z-30 hover:!rotate-0 hover:!scale-105 cursor-pointer ring-1 ring-white/5"
        title="Multi Cabang Godinov POS"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-lg bg-ink-900/90 p-0.5 border border-ink-800">
            <LottiePlayer animationData={storeBuildingAnimation} className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-paper-50 truncate">Multi Cabang</span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            </div>
            <p className="text-[10px] sm:text-[11px] text-paper-50/60 truncate">5 Outlet Terkoneksi</p>
          </div>
        </div>
      </div>

      {/* Kartu Kanan (Belakang): Laporan & Penjualan */}
      <div
        className="absolute top-1 right-2 sm:-right-4 z-0 w-52 sm:w-64 rotate-3 sm:rotate-6 rounded-2xl border border-ink-800/90 bg-ink-950/95 p-3 sm:p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 group-hover:translate-x-3 group-hover:-translate-y-2 group-hover:rotate-8 hover:!z-30 hover:!rotate-0 hover:!scale-105 cursor-pointer ring-1 ring-white/5"
        title="Laporan Real-Time Godinov POS"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-lg bg-ink-900/90 p-0.5 border border-ink-800">
            <LottiePlayer animationData={graphicSalesAnimation} className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-paper-50 truncate">Laporan Penjualan</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-paper-50/60 truncate">Omzet & Kas Akurat</p>
          </div>
        </div>
      </div>

      {/* Kartu Tengah (Depan): Terminal Kasir Interaktif */}
      <div className="relative z-10 transition-transform duration-300">
        <PosDeviceMock />
      </div>
    </div>
  );
}

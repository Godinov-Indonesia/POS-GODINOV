"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { StatusPill, type ConnectionState } from "@/components/common/StatusPill";
import {
  Wifi,
  WifiOff,
  Database,
  ShieldCheck,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PosDeviceMockProps {
  autoPlay?: boolean;
  className?: string;
}

export function PosDeviceMock({
  autoPlay = true,
  className,
}: PosDeviceMockProps) {
  const shouldReduceMotion = useReducedMotion();
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("online");
  const [queueCount, setQueueCount] = React.useState<number>(0);

  // Siklus status otomatis: Online -> Offline (12 queue) -> Syncing -> Online
  React.useEffect(() => {
    if (!autoPlay || shouldReduceMotion) {
      return;
    }

    const timer = setInterval(() => {
      setConnectionState((prev) => {
        if (prev === "online") {
          setQueueCount(12);
          return "offline";
        }
        if (prev === "offline") {
          return "syncing";
        }
        setQueueCount(0);
        return "online";
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [autoPlay, shouldReduceMotion]);

  return (
    <div
      data-testid="hero-device-mock"
      data-state={connectionState}
      className={cn(
        "relative mx-auto w-full max-w-xl rounded-2xl border border-ink-800 bg-ink-950/90 p-3 shadow-2xl backdrop-blur-xl sm:p-5 ring-1 ring-white/5",
        className
      )}
    >
      {/* Device Bezel Header */}
      <div className="mb-4 flex items-center justify-between border-b border-ink-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-alert-500/80" />
          <span className="h-3 w-3 rounded-full bg-signal-500/80" />
          <span className="h-3 w-3 rounded-full bg-brand-500/80" />
          <span className="ml-2 font-mono text-[11px] text-paper-50/50">
            Godinov POS V2 · Terminal #01 (Sinyal 1 Bar)
          </span>
        </div>
        <StatusPill state={connectionState} queueCount={queueCount} />
      </div>

      {/* Main Terminal Screen */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 rounded-xl border border-ink-800 bg-ink-900/90 p-4">
        {/* Left: Active Order / Cart */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-paper-50/80">
                <ShoppingCart className="h-3.5 w-3.5 text-brand-300" />
                Pesanan #TX-8821
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
              <span className="text-xs uppercase tracking-wider text-paper-50/60 font-mono">
                Total Transaksi
              </span>
              <span className="font-mono text-xl font-bold tracking-tight text-brand-300 tabular-nums">
                Rp 96.000
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 font-semibold text-ink-950 hover:bg-brand-300 transition-colors"
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

        {/* Right: Security & Storage Telemetry */}
        <div className="md:col-span-5 flex flex-col justify-between rounded-lg border border-ink-800/80 bg-ink-950/70 p-3 space-y-3 font-mono text-[11px]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-paper-50/50 mb-2">
              Telemetri Hardware
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-paper-50/80">
                <span className="flex items-center gap-1 text-[11px]">
                  <Database className="h-3 w-3 text-brand-300" />
                  Local DB
                </span>
                <span className="text-brand-300">IndexedDB Siap</span>
              </div>

              <div className="flex items-center justify-between text-paper-50/80">
                <span className="flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="h-3 w-3 text-brand-300" />
                  Kiosk Mode
                </span>
                <span className="text-paper-50/90 font-semibold">Terkunci</span>
              </div>

              <div className="flex items-center justify-between text-paper-50/80">
                <span className="flex items-center gap-1 text-[11px]">
                  {connectionState === "offline" ? (
                    <WifiOff className="h-3 w-3 text-signal-500" />
                  ) : (
                    <Wifi className="h-3 w-3 text-brand-300" />
                  )}
                  Jaringan
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    connectionState === "online" && "text-brand-300",
                    connectionState === "offline" && "text-signal-500",
                    connectionState === "syncing" && "text-brand-300"
                  )}
                >
                  {connectionState === "offline" ? "Terputus" : "Tersambung"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Manual Override for QA / Deterministic Test */}
          <div className="border-t border-ink-800/80 pt-2">
            <div className="text-[10px] text-paper-50/40 mb-1.5">
              Simulasi Status:
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => {
                  setConnectionState("online");
                  setQueueCount(0);
                }}
                className={cn(
                  "rounded px-1.5 py-1 text-[10px] text-center transition-colors",
                  connectionState === "online"
                    ? "bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/40"
                    : "bg-ink-900 text-paper-50/60 hover:bg-ink-800"
                )}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectionState("offline");
                  setQueueCount(12);
                }}
                className={cn(
                  "rounded px-1.5 py-1 text-[10px] text-center transition-colors",
                  connectionState === "offline"
                    ? "bg-signal-500/20 text-signal-500 font-semibold border border-signal-500/40"
                    : "bg-ink-900 text-paper-50/60 hover:bg-ink-800"
                )}
              >
                Offline
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectionState("syncing");
                  setQueueCount(12);
                }}
                className={cn(
                  "rounded px-1.5 py-1 text-[10px] text-center transition-colors",
                  connectionState === "syncing"
                    ? "bg-brand-300/20 text-brand-300 font-semibold border border-brand-300/40"
                    : "bg-ink-900 text-paper-50/60 hover:bg-ink-800"
                )}
              >
                Sync
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

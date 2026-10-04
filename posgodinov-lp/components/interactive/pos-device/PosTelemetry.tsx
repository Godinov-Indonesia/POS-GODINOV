import * as React from "react";
import { Wifi, WifiOff, HardDrive, ShieldCheck } from "lucide-react";
import type { ConnectionState } from "@/components/common/StatusPill";
import { cn } from "@/lib/utils";

export function PosTelemetry({ connectionState }: { connectionState: ConnectionState }) {
  const isOffline = connectionState === "offline";

  return (
    <div className="md:col-span-5 flex flex-col justify-center rounded-lg border border-ink-800/80 bg-ink-950/70 p-3 space-y-2.5 font-mono text-[11px]">
      <div className="text-[10px] uppercase tracking-wider text-paper-50/50 mb-1">
        Status Kasir
      </div>
      <div className="space-y-2 text-paper-50/80">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3 text-brand-500" />Memori Kasir</span>
          <span className="text-brand-500 font-semibold">Tersimpan Aman</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-brand-500" />Layar Kasir</span>
          <span className="text-paper-50/90 font-semibold">Terkunci</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {isOffline ? <WifiOff className="h-3 w-3 text-signal-500" /> : <Wifi className="h-3 w-3 text-brand-500" />}
            Koneksi Internet
          </span>
          <span className={cn("font-semibold", !isOffline ? "text-brand-500" : "text-signal-500")}>
            {isOffline ? "Mati (Tetap Jalan)" : "Terhubung"}
          </span>
        </div>
      </div>
    </div>
  );
}

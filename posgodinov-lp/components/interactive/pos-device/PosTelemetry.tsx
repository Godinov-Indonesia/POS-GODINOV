import * as React from "react";
import { Wifi, WifiOff, Database, ShieldCheck } from "lucide-react";
import type { ConnectionState } from "@/components/common/StatusPill";
import { cn } from "@/lib/utils";

export interface PosTelemetryProps {
  connectionState: ConnectionState;
  onSetState: (state: ConnectionState, queue: number) => void;
}

export function PosTelemetry({ connectionState, onSetState }: PosTelemetryProps) {
  const isOffline = connectionState === "offline";

  return (
    <div className="md:col-span-5 flex flex-col justify-between rounded-lg border border-ink-800/80 bg-ink-950/70 p-3 space-y-3 font-mono text-[11px]">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-paper-50/50 mb-2">
          Telemetri Hardware
        </div>

        <div className="space-y-2 text-paper-50/80">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Database className="h-3 w-3 text-brand-500" />Local DB</span>
            <span className="text-brand-500">IndexedDB Siap</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-brand-500" />Kiosk Mode</span>
            <span className="text-paper-50/90 font-semibold">Terkunci</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              {isOffline ? <WifiOff className="h-3 w-3 text-signal-500" /> : <Wifi className="h-3 w-3 text-brand-500" />}
              Jaringan
            </span>
            <span className={cn("font-semibold", !isOffline ? "text-brand-500" : "text-signal-500")}>
              {isOffline ? "Terputus" : "Tersambung"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-800/80 pt-2">
        <div className="text-[10px] text-paper-50/40 mb-1.5">Simulasi Status:</div>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => onSetState("online", 0)}
            className={cn("rounded px-1.5 py-1 text-[10px] transition-colors", connectionState === "online" ? "bg-brand-500/20 text-brand-500 font-semibold border border-brand-500/40" : "bg-ink-900 text-paper-50/60 hover:bg-ink-800")}
          >
            Online
          </button>
          <button
            type="button"
            onClick={() => onSetState("offline", 12)}
            className={cn("rounded px-1.5 py-1 text-[10px] transition-colors", isOffline ? "bg-signal-500/20 text-signal-500 font-semibold border border-signal-500/40" : "bg-ink-900 text-paper-50/60 hover:bg-ink-800")}
          >
            Offline
          </button>
          <button
            type="button"
            onClick={() => onSetState("syncing", 12)}
            className={cn("rounded px-1.5 py-1 text-[10px] transition-colors", connectionState === "syncing" ? "bg-brand-300/20 text-brand-300 font-semibold border border-brand-300/40" : "bg-ink-900 text-paper-50/60 hover:bg-ink-800")}
          >
            Sync
          </button>
        </div>
      </div>
    </div>
  );
}

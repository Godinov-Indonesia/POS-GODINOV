"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

export type ConnectionState = "online" | "offline" | "syncing";

export interface StatusPillProps {
  state: ConnectionState;
  queueCount?: number;
  className?: string;
}

export function StatusPill({
  state,
  queueCount = 12,
  className,
}: StatusPillProps) {
  return (
    <div
      data-testid="status-pill"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-mono border backdrop-blur-md transition-all select-none",
        state === "online" &&
          "border-brand-500/30 bg-brand-500/10 text-brand-300",
        state === "offline" &&
          "border-signal-500/40 bg-signal-500/10 text-signal-500",
        state === "syncing" &&
          "border-brand-300/40 bg-brand-300/10 text-brand-300",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {state === "online" && (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </>
        )}
        {state === "offline" && (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-signal-500" />
        )}
        {state === "syncing" && (
          <RefreshCw className="h-2.5 w-2.5 animate-spin text-brand-300" />
        )}
      </span>

      <span className="font-medium tracking-tight">
        {state === "online" && "Online · Terhubung"}
        {state === "offline" && (
          <>
            Offline —{" "}
            <span className="tabular-nums font-semibold">{queueCount}</span>{" "}
            transaksi tersimpan
          </>
        )}
        {state === "syncing" && (
          <>
            Mengirim{" "}
            <span className="tabular-nums font-semibold">{queueCount}</span>{" "}
            transaksi...
          </>
        )}
      </span>
    </div>
  );
}

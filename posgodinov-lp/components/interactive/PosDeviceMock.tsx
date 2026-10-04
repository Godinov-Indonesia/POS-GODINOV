"use client";

import * as React from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { StatusPill, type ConnectionState } from "@/components/common/StatusPill";
import { PosCart } from "./pos-device/PosCart";
import { PosTelemetry } from "./pos-device/PosTelemetry";
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
    if (!autoPlay || shouldReduceMotion) return;

    const timer = setInterval(() => {
      setConnectionState((prev) => {
        if (prev === "online") {
          setQueueCount(12);
          return "offline";
        }
        if (prev === "offline") return "syncing";
        setQueueCount(0);
        return "online";
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [autoPlay, shouldReduceMotion]);

  const handleManualState = (state: ConnectionState, queue: number) => {
    setConnectionState(state);
    setQueueCount(queue);
  };

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
          <span className="h-2.5 w-2.5 rounded-full bg-alert-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500/80" />
          <div className="ml-1.5 flex items-center gap-1.5">
            <Image
              src="/images/logo-transparent.webp"
              alt="Godinov POS"
              width={65}
              height={18}
              className="h-3.5 w-auto object-contain opacity-80"
            />
            <span className="font-mono text-[10px] text-paper-50/50">
              · Terminal #01 (Sinyal 1 Bar)
            </span>
          </div>
        </div>
        <StatusPill state={connectionState} queueCount={queueCount} />
      </div>

      {/* Main Terminal Screen */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 rounded-xl border border-ink-800 bg-ink-900/90 p-4">
        <PosCart />
        <PosTelemetry
          connectionState={connectionState}
          onSetState={handleManualState}
        />
      </div>
    </div>
  );
}

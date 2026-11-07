"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";

interface AnnouncementBarProps {
  text: string;
}

export function AnnouncementBar({ text }: AnnouncementBarProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || !text) return null;

  return (
    <div
      data-testid="announcement-bar"
      className="relative z-50 w-full bg-brand-500/15 border-b border-brand-500/30 px-4 py-2 text-center text-xs font-medium text-paper-50 transition-all backdrop-blur-xs"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 pr-6">
        <Sparkles className="h-3.5 w-3.5 text-brand-400 shrink-0 animate-pulse" />
        <span className="truncate">{text}</span>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Tutup pengumuman"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-paper-50/60 hover:text-paper-50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

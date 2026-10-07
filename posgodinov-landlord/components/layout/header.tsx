"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Radio } from "lucide-react";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Executive Overview",
  "/tenants": "Tenant 360 Directory",
  "/plans": "Plan & Feature Matrix",
  "/cms": "Landing Page CMS",
  "/campaigns": "In-App Campaigns & Ads",
  "/audit-logs": "Audit Trail Logs",
};

export function Header() {
  const pathname = usePathname();
  const currentTitle =
    TITLE_MAP[pathname] ||
    (pathname.startsWith("/tenants/") ? "Tenant Detail 360" : "Console");

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500 font-medium">Landlord</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-zinc-200 font-semibold">{currentTitle}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
          <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
          <span>Core API Connected</span>
        </div>
      </div>
    </header>
  );
}

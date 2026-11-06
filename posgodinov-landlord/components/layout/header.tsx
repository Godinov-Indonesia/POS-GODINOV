"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Executive Overview",
  "/tenants": "Tenant 360 Directory",
  "/plans": "Plan & Feature Matrix",
  "/backups": "Database Backups & Snapshot",
  "/cms": "Landing Page CMS",
  "/campaigns": "In-App Campaigns & Ads",
  "/audit-logs": "Audit Trail Logs",
};

export function Header() {
  const pathname = usePathname();
  const currentTitle =
    TITLE_MAP[pathname] ||
    (pathname.startsWith("/tenants/") ? "Detail Tenant 360" : "Console");

  return (
    <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-fg-subtle font-medium">Landlord</span>
        <ChevronRight className="size-3.5 text-border-strong" />
        <span className="text-fg font-semibold">{currentTitle}</span>
      </div>

      <div className="flex items-center gap-3">
        <Badge tone="success" icon={CheckCircle2}>
          Core API Connected
        </Badge>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-muted border border-border text-xs text-fg-muted">
          <ShieldCheck className="size-3.5 text-accent" />
          <span className="font-mono text-[11px]">PROD-LANDLORD</span>
        </div>
      </div>
    </header>
  );
}

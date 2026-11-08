"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Layers,
  Globe,
  Megaphone,
  ScrollText,
  LogOut,
  Database,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Tenant 360",
        href: "/tenants",
        icon: Building2,
      },
      {
        label: "Plan & Fitur",
        href: "/plans",
        icon: Layers,
      },
    ],
  },
  {
    title: "Infrastruktur & Bisnis",
    items: [
      {
        label: "Kredensial POS Mobile",
        href: "/pos-credentials",
        icon: Smartphone,
      },
      {
        label: "Database Backups",
        href: "/backups",
        icon: Database,
      },
      {
        label: "Kampanye & Iklan",
        href: "/campaigns",
        icon: Megaphone,
      },
      {
        label: "Landing CMS",
        href: "/cms",
        icon: Globe,
      },
      {
        label: "Audit Trail",
        href: "/audit-logs",
        icon: ScrollText,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Berhasil keluar");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar");
    }
  };

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="w-64 border-r border-border-inverse bg-surface-inverse text-fg-inverse flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="h-16 border-b border-border-inverse px-5 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo variant="icon" className="size-7" />
          <div>
            <span className="font-bold text-xs tracking-tight text-fg-inverse block">
              POS-GODINOV
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-accent bg-accent-subtle/20 px-1 py-0.2 rounded border border-accent/30">
              Landlord Console
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.title ?? groupIdx}>
            {group.title && (
              <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-fg-inverse/50">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isLinkActive(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        active
                          ? "border-l-[3px] border-accent bg-accent-subtle pl-[9px] font-semibold text-accent"
                          : "text-fg-inverse/80 hover:bg-fg-inverse/10 hover:text-fg-inverse"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-inverse/60")} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-border-inverse">
        <div className="px-3 py-2.5 rounded-lg bg-fg-inverse/5 border border-border-inverse mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-inverse truncate">
              Superadmin
            </span>
            <span className="text-[9px] font-mono uppercase bg-accent-subtle/20 text-accent border border-accent/30 px-1 rounded">
              ROOT
            </span>
          </div>
          <div className="text-[10px] text-fg-inverse/50 font-mono truncate mt-0.5">
            Godinov Central Console
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger-subtle/20 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </aside>
  );
}

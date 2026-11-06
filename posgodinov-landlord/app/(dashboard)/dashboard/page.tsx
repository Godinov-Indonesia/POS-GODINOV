"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Layers,
  ArrowUpRight,
  Database,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { formatIDR } from "@/lib/utils";
import { LandlordMetricsOverview, ApiResponse } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";

export default function DashboardOverviewPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["landlord-metrics-overview"],
    queryFn: () =>
      apiClient<ApiResponse<LandlordMetricsOverview>>(
        "/api/landlord/metrics/overview"
      ),
  });

  const metrics = data?.data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            Executive SaaS Overview
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Metrik agregat real-time performa bisnis multi-tenant POS-GODINOV.
          </p>
        </div>

        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="neutral"
          size="sm"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Segarkan Data</span>
        </Button>
      </div>

      {isError && (
        <Banner tone="danger">
          <div className="font-semibold">Gagal memuat metrik landlord</div>
          <div className="text-fg-muted mt-0.5">
            {(error as Error)?.message || "Koneksi backend tidak dapat diakses."}
          </div>
        </Banner>
      )}

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Estimasi MRR SaaS"
          value={isLoading ? "..." : formatIDR(metrics?.estimated_mrr_minor || 0)}
          hint="Monthly Recurring Revenue aktif"
          icon={TrendingUp}
        />
        <StatCard
          label="Total Tenant Terdaftar"
          value={isLoading ? "..." : (metrics?.total_businesses ?? 0)}
          hint="Tenant merchant terdaftar"
          icon={Building2}
        />
        <StatCard
          label="Tenant Beroperasi Aktif"
          value={isLoading ? "..." : (metrics?.active_businesses ?? 0)}
          hint="Status ACTIVE atau TRIAL"
          icon={CheckCircle2}
        />
        <StatCard
          label="Akun Ditangguhkan"
          value={isLoading ? "..." : (metrics?.suspended_businesses ?? 0)}
          hint="Dibatasi karena dunning / audit"
          icon={AlertOctagon}
        />
      </div>

      {/* Breakdown Tier & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-accent" />
                <CardTitle>Distribusi Paket Tenant</CardTitle>
              </div>
              <span className="text-xs text-fg-subtle">Live Breakdown</span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : Object.entries(metrics?.businesses_by_plan || {}).length === 0 ? (
              <div className="py-8 text-center text-xs text-fg-subtle">
                Belum ada data distribusi paket.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(metrics?.businesses_by_plan || {}).map(
                  ([planCode, count]) => {
                    const total = metrics?.total_businesses || 1;
                    const percentage = Math.round((count / total) * 100);

                    return (
                      <div key={planCode} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-fg uppercase tracking-wider">
                            {planCode}
                          </span>
                          <span className="font-mono text-fg-muted">
                            {count} tenant ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Operations Navigation */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Operasi Cepat Landlord</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link
              href="/tenants"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4 text-accent" />
                <span className="text-xs font-medium text-fg">
                  Direktori Tenant 360
                </span>
              </div>
              <ArrowUpRight className="size-3.5 text-fg-subtle group-hover:text-fg" />
            </Link>

            <Link
              href="/plans"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="size-4 text-accent" />
                <span className="text-xs font-medium text-fg">
                  Matriks Fitur & Harga Paket
                </span>
              </div>
              <ArrowUpRight className="size-3.5 text-fg-subtle group-hover:text-fg" />
            </Link>

            <Link
              href="/backups"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Database className="size-4 text-accent" />
                <span className="text-xs font-medium text-fg">
                  Database Backups & Snapshot
                </span>
              </div>
              <ArrowUpRight className="size-3.5 text-fg-subtle group-hover:text-fg" />
            </Link>
          </CardContent>
          <div className="p-5 pt-3 border-t border-border text-[11px] text-fg-subtle flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-success" />
            <span>Multi-tenant ACID terjamin oleh Postgres landlord engine.</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

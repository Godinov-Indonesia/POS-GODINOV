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
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { formatIDR } from "@/lib/utils";
import { LandlordMetricsOverview, ApiResponse } from "@/lib/types";

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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Executive SaaS Overview
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Metrik agregat real-time performa bisnis multi-tenant POS-GODINOV
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-semibold">Gagal memuat metrik landlord</div>
            <div className="text-zinc-400 mt-0.5">
              {(error as Error)?.message || "Koneksi backend tidak dapat diakses."}
            </div>
          </div>
        </div>
      )}

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Estimated MRR */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Estimasi MRR SaaS
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {isLoading ? (
                <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded" />
              ) : (
                formatIDR(metrics?.estimated_mrr_minor || 0)
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Monthly Recurring Revenue aktif
            </p>
          </div>
        </div>

        {/* KPI 2: Total Businesses */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Total Tenant Terdaftar
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {isLoading ? (
                <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
              ) : (
                metrics?.total_businesses ?? 0
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Tenant merchant di seluruh outlet
            </p>
          </div>
        </div>

        {/* KPI 3: Active Tenants */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Tenant Beroperasi Aktif
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {isLoading ? (
                <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
              ) : (
                metrics?.active_businesses ?? 0
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Status langganan ACTIVE / TRIAL
            </p>
          </div>
        </div>

        {/* KPI 4: Suspended Tenants */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Akun Dibekukan (Suspended)
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {isLoading ? (
                <div className="h-8 w-16 bg-zinc-800 animate-pulse rounded" />
              ) : (
                metrics?.suspended_businesses ?? 0
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Dibatasi karena dunning / pelanggaran
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown Tier & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                Distribusi Paket Tenant
              </h2>
            </div>
            <span className="text-xs text-zinc-500">Live Breakdown</span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-zinc-800/60 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(metrics?.businesses_by_plan || {}).length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Belum ada data distribusi paket.
                </div>
              ) : (
                Object.entries(metrics?.businesses_by_plan || {}).map(
                  ([planCode, count]) => {
                    const total = metrics?.total_businesses || 1;
                    const percentage = Math.round((count / total) * 100);

                    return (
                      <div key={planCode} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-300 uppercase tracking-wider">
                            {planCode}
                          </span>
                          <span className="font-mono text-zinc-400">
                            {count} tenant ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          )}
        </div>

        {/* Quick Operations Navigation */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-4">
              Operasi Cepat Landlord
            </h2>
            <div className="space-y-2.5">
              <Link
                href="/tenants"
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-medium text-zinc-200">
                    Kelola Direktori Tenant
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              </Link>

              <Link
                href="/plans"
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-zinc-200">
                    Edit Kuota & Matriks Fitur
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              </Link>

              <Link
                href="/cms"
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-200">
                    Revalidasi Cache Landing CMS
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800/80 mt-6 text-[11px] text-zinc-500">
            Sistem pengawasan landlord menjamin isolasi data antar tenant tetap ACID.
          </div>
        </div>
      </div>
    </div>
  );
}

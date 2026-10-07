"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { BusinessWithSubscription, ApiResponse } from "@/lib/types";

function getStatusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3" /> Active
        </span>
      );
    case "SUSPENDED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" /> Suspended
        </span>
      );
    case "PAST_DUE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" /> Past Due
        </span>
      );
    case "TRIAL":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="w-3 h-3" /> Trial
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          {status || "UNKNOWN"}
        </span>
      );
  }
}

export default function TenantsDirectoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 15;

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (search.trim()) queryParams.set("search", search.trim());
  if (statusFilter) queryParams.set("status", statusFilter);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["landlord-tenants", page, search, statusFilter],
    queryFn: () =>
      apiClient<ApiResponse<BusinessWithSubscription[]>>(
        `/api/landlord/businesses?${queryParams.toString()}`
      ),
  });

  const businesses = data?.data || [];
  const meta = data?.meta || {};
  const total = meta.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Tenant 360 Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manajemen direktori seluruh tenant, kepemilikan, paket aktif, dan status operasional
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama bisnis, serial, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="TRIAL">TRIAL</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Bisnis / Serial</th>
                <th className="py-3 px-4 font-semibold">Owner & Email</th>
                <th className="py-3 px-4 font-semibold">Paket SaaS</th>
                <th className="py-3 px-4 font-semibold">Status Operasi</th>
                <th className="py-3 px-4 font-semibold">Tgl Terdaftar</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-5 bg-zinc-800/50 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-red-400">
                    {(error as Error)?.message || "Gagal memuat direktori tenant"}
                  </td>
                </tr>
              ) : businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <div>Tidak ada tenant yang sesuai dengan kriteria pencarian.</div>
                  </td>
                </tr>
              ) : (
                businesses.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-zinc-850/50 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-100">{b.name}</div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {b.serial_business}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-300">{b.owner_name}</div>
                      <div className="text-[11px] text-zinc-500">{b.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono uppercase px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-indigo-300 border border-indigo-500/20">
                        {b.plan_code || "FREE"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(b.subscription_status)}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                      {formatDate(b.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/tenants/${b.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300 text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail 360</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Total <span className="font-mono font-medium text-zinc-200">{total}</span> tenant terdaftar
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px]">
              Hal {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

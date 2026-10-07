"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { ApiResponse, LandlordAuditLog } from "@/lib/types";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["landlord-audit-logs", page],
    queryFn: () =>
      apiClient<ApiResponse<LandlordAuditLog[]>>(
        `/api/landlord/audit-logs?page=${page}&limit=${limit}`
      ),
  });

  const logs = data?.data || [];
  const meta = data?.meta || {};
  const total = meta.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Audit Trail & Log Superadmin
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Riwayat seluruh tindakan administratif untuk kepatuhan dan keamanan
          </p>
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Tindakan</th>
                <th className="py-3 px-4 font-semibold">Target (ID/Type)</th>
                <th className="py-3 px-4 font-semibold">Metadata</th>
                <th className="py-3 px-4 font-semibold">Waktu & IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500 font-sans">
                    Memuat log audit...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-red-400 font-sans">
                    {(error as Error)?.message || "Gagal memuat log audit"}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500 font-sans">
                    <ScrollText className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    Tidak ada log audit tersedia.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-indigo-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      <div>{log.target_type}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {log.target_id}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[10px] text-zinc-400 max-w-xs truncate" title={JSON.stringify(log.metadata)}>
                        {JSON.stringify(log.metadata || {})}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                      {log.ip_address && (
                        <div className="mt-1">IP: {log.ip_address}</div>
                      )}
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
            Total <span className="font-mono font-medium text-zinc-200">{total}</span> rekaman log
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px]">
              Hal {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

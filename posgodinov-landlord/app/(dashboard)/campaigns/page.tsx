"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  BarChart,
  Eye,
  MousePointerClick,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { ApiResponse, SaaSCampaign } from "@/lib/types";

export default function CampaignsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landlord-campaigns"],
    queryFn: () =>
      apiClient<ApiResponse<SaaSCampaign[]>>("/api/landlord/campaigns"),
  });

  const campaigns = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            In-App Campaigns & Promosi
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manajemen banner iklan dan pop-up in-app untuk tenant merchant
          </p>
        </div>

        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Kampanye Baru</span>
        </button>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Judul & Format</th>
                <th className="py-3 px-4 font-semibold">Target Tier</th>
                <th className="py-3 px-4 font-semibold">Performa (Imp/Click)</th>
                <th className="py-3 px-4 font-semibold">Status & Waktu</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    Memuat daftar kampanye...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-red-400">
                    {(error as Error)?.message || "Gagal memuat kampanye"}
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <Megaphone className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    Belum ada kampanye in-app yang berjalan.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const ctr =
                    c.impression_count > 0
                      ? ((c.click_count / c.impression_count) * 100).toFixed(2)
                      : "0.00";
                  return (
                    <tr key={c.id} className="hover:bg-zinc-850/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">{c.title}</div>
                        <div className="text-[10px] font-mono text-indigo-400 mt-0.5">
                          {c.format} • {c.placement}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {c.target_tier === "FREE_ONLY" ? "Hanya FREE" : c.target_tier}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Eye className="w-3.5 h-3.5 text-zinc-500" /> {c.impression_count}
                          </span>
                          <span className="flex items-center gap-1 text-zinc-400">
                            <MousePointerClick className="w-3.5 h-3.5 text-zinc-500" /> {c.click_count}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300">
                            {ctr}% CTR
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.is_active ? (
                          <span className="text-emerald-400 font-medium">Aktif</span>
                        ) : (
                          <span className="text-zinc-500">Selesai</span>
                        )}
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {formatDate(c.starts_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer">
                          <BarChart className="w-3 h-3" /> Report
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

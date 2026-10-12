"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  BarChart,
  Eye,
  MousePointerClick,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { ApiResponse, SaaSCampaign } from "@/lib/types";

type CampaignFormat = "POPUP_MODAL" | "CAROUSEL_SLIDE" | "HEADER_BANNER";
type CampaignActionType = "INTERNAL_UPGRADE" | "EXTERNAL_URL" | "INFO_ONLY";
type CampaignTargetTier = "FREE_ONLY" | "ALL";

const DEFAULT_FORM = {
  title: "",
  subtitle: "",
  format: "CAROUSEL_SLIDE" as CampaignFormat,
  placement: "dashboard",
  image_url: "",
  action_type: "INFO_ONLY" as CampaignActionType,
  action_url: "",
  action_label: "",
  target_tier: "ALL" as CampaignTargetTier,
  priority: 0,
  skip_delay_seconds: 15,
  starts_at: "",
  ends_at: "",
  is_active: true,
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landlord-campaigns"],
    queryFn: () =>
      apiClient<ApiResponse<SaaSCampaign[]>>("/api/landlord/campaigns"),
  });

  const rawCampaigns = data?.data;
  const campaigns: SaaSCampaign[] = Array.isArray(rawCampaigns)
    ? rawCampaigns
    : Array.isArray((rawCampaigns as any)?.campaigns)
    ? (rawCampaigns as any).campaigns
    : [];

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient("/api/landlord/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Kampanye baru berhasil dibuat!");
      queryClient.invalidateQueries({ queryKey: ["landlord-campaigns"] });
      setModalOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat kampanye");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Judul kampanye wajib diisi");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || undefined,
      action_url: form.action_url?.trim() || undefined,
      action_label: form.action_label?.trim() || "Tingkatkan Sekarang",
      image_url: form.image_url?.trim() || "",
      starts_at: form.starts_at
        ? new Date(form.starts_at).toISOString()
        : new Date().toISOString(),
      ends_at: form.ends_at
        ? new Date(form.ends_at).toISOString()
        : undefined,
    };

    createMutation.mutate(payload);
  };

  const set = (field: keyof typeof DEFAULT_FORM, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            In-App Campaigns &amp; Promosi
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manajemen banner iklan dan pop-up in-app untuk tenant merchant
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Kampanye Baru</span>
        </button>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Judul &amp; Format</th>
                <th className="py-3 px-4 font-semibold">Target Tier</th>
                <th className="py-3 px-4 font-semibold">Performa (Imp/Click)</th>
                <th className="py-3 px-4 font-semibold">Status &amp; Waktu</th>
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
                          {c.format} &bull; {c.placement}
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

      {/* Create Campaign Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100">Buat Kampanye Baru</h2>
              <button
                type="button"
                onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-zinc-300 font-medium mb-1">Judul *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    required
                    placeholder="Upgrade ke Pro untuk fitur lengkap"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-zinc-300 font-medium mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder="Deskripsi singkat kampanye"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Format</label>
                  <select
                    value={form.format}
                    onChange={(e) => set("format", e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="CAROUSEL_SLIDE">CAROUSEL_SLIDE</option>
                    <option value="HEADER_BANNER">HEADER_BANNER</option>
                    <option value="POPUP_MODAL">POPUP_MODAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Placement</label>
                  <input
                    type="text"
                    value={form.placement}
                    onChange={(e) => set("placement", e.target.value)}
                    placeholder="dashboard, reports, products..."
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-zinc-300 font-medium mb-1">URL Gambar</label>
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => set("image_url", e.target.value)}
                    placeholder="https://cdn.example.com/banner.png"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Tipe Aksi</label>
                  <select
                    value={form.action_type}
                    onChange={(e) => set("action_type", e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="INFO_ONLY">INFO_ONLY</option>
                    <option value="INTERNAL_UPGRADE">INTERNAL_UPGRADE</option>
                    <option value="EXTERNAL_URL">EXTERNAL_URL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Label Tombol</label>
                  <input
                    type="text"
                    value={form.action_label}
                    onChange={(e) => set("action_label", e.target.value)}
                    placeholder="Upgrade Sekarang"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {form.action_type !== "INFO_ONLY" && (
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-300 font-medium mb-1">URL Aksi</label>
                    <input
                      type="text"
                      value={form.action_url}
                      onChange={(e) => set("action_url", e.target.value)}
                      placeholder="/subscription atau https://..."
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Target Tier</label>
                  <select
                    value={form.target_tier}
                    onChange={(e) => set("target_tier", e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ALL">ALL (semua tier)</option>
                    <option value="FREE_ONLY">FREE_ONLY (hanya paket gratis)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Prioritas</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => set("priority", parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Skip Delay (detik)</label>
                  <input
                    type="number"
                    value={form.skip_delay_seconds}
                    onChange={(e) => set("skip_delay_seconds", parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Mulai (opsional)</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => set("starts_at", e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Berakhir (opsional)</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                    className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active" className="text-zinc-300 cursor-pointer">
                    Aktifkan kampanye segera
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? "Membuat..." : "Buat Kampanye"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Save,
  RefreshCw,
  Sparkles,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { ApiResponse } from "@/lib/types";

export default function LandingCMSPage() {
  const queryClient = useQueryClient();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["landlord-landing-settings"],
    queryFn: () =>
      apiClient<ApiResponse<Record<string, any>>>(
        "/api/landlord/landing/settings"
      ),
  });

  // State form
  const [heroTagline, setHeroTagline] = useState(() => (data?.data?.hero_banner?.tagline as string) ?? "Aplikasi POS Kasir Modern #1 di Indonesia");
  const [heroTitle, setHeroTitle] = useState(() => (data?.data?.hero_banner?.title as string) ?? "Kelola Bisnis Ritel & F&B Lebih Efisien & Cepat");
  const [heroSubtitle, setHeroSubtitle] = useState(() => (data?.data?.hero_banner?.subtitle as string) ?? "Sistem Point of Sale terintegrasi multi-outlet, offline-first, dan manajemen stok inventori otomatis.");
  const [contactWhatsApp, setContactWhatsApp] = useState(() => (data?.data?.contacts?.whatsapp as string) ?? "6281234567890");
  const [contactEmail, setContactEmail] = useState(() => (data?.data?.contacts?.email as string) ?? "support@godinov.com");
  const [announcementText, setAnnouncementText] = useState(() => (data?.data?.announcement?.text as string) ?? "🚀 Promo Spesial Diskon 30% Paket Pro Tahunan! Berlaku hingga akhir bulan.");
  const [announcementActive, setAnnouncementActive] = useState(() => (data?.data?.announcement?.is_active as boolean) ?? true);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      apiClient("/api/landlord/landing/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => {
      toast.success("Pengaturan landing page berhasil disimpan!");
      queryClient.invalidateQueries({ queryKey: ["landlord-landing-settings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyimpan konten CMS");
    },
  });

  // Revalidate ISR Cache Mutation
  const revalidateMutation = useMutation({
    mutationFn: () =>
      apiClient("/api/landlord/landing/revalidate", {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Revalidasi cache Landing Page berhasil dipicu!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal merevalidasi cache landing page");
    },
  });

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      hero_banner: {
        tagline: heroTagline,
        title: heroTitle,
        subtitle: heroSubtitle,
      },
      contacts: {
        whatsapp: contactWhatsApp,
        email: contactEmail,
      },
      announcement: {
        text: announcementText,
        is_active: announcementActive,
      },
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Landing Page CMS & On-Demand Revalidation
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Kelola konten promosi publik, FAQ, banner hero, dan pemicu invalidasi cache ISR landing page
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => revalidateMutation.mutate()}
            disabled={revalidateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {revalidateMutation.isPending
                ? "Merevalidasi Cache..."
                : "Purge & Revalidate Landing"}
            </span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Hero Banner Section */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Hero Header & Tagline</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Badge / Tagline Atas
              </label>
              <input
                type="text"
                value={heroTagline}
                onChange={(e) => setHeroTagline(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Judul Utama (Headline H1)
              </label>
              <input
                type="text"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Sub-Headline Deskripsi
              </label>
              <textarea
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="w-full h-20 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Announcement Bar Section */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Announcement Bar (Top Bar Landing)</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={announcementActive}
                onChange={(e) => setAnnouncementActive(e.target.checked)}
                className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Tampilkan Pengumuman</span>
            </label>
          </div>

          <div className="text-xs">
            <input
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Teks berjalan promosi..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Kontak Customer Care & CS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                WhatsApp CS (Format 62...)
              </label>
              <input
                type="text"
                value={contactWhatsApp}
                onChange={(e) => setContactWhatsApp(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Email CS Support
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saveMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan CMS"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

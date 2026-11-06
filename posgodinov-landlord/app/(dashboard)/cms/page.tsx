"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Globe,
  Phone,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { ApiResponse } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingCMSPage() {
  const queryClient = useQueryClient();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["landlord-landing-settings"],
    queryFn: () =>
      apiClient<ApiResponse<Record<string, any>>>(
        "/api/landlord/landing/settings"
      ),
  });

  const [heroTagline, setHeroTagline] = useState("Aplikasi POS Kasir Modern #1 di Indonesia");
  const [heroTitle, setHeroTitle] = useState("Kelola Bisnis Ritel & F&B Lebih Efisien & Cepat");
  const [heroSubtitle, setHeroSubtitle] = useState("Sistem Point of Sale terintegrasi multi-outlet, offline-first, dan manajemen stok inventori otomatis.");
  const [contactWhatsApp, setContactWhatsApp] = useState("6281234567890");
  const [contactEmail, setContactEmail] = useState("support@godinov.com");
  const [announcementText, setAnnouncementText] = useState("🚀 Promo Spesial Diskon 30% Paket Pro Tahunan! Berlaku hingga akhir bulan.");
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [apkPosUrl, setApkPosUrl] = useState("");
  const [apkSoUrl, setApkSoUrl] = useState("");

  useEffect(() => {
    if (data?.data) {
      if (data.data.hero_banner?.tagline !== undefined) setHeroTagline(data.data.hero_banner.tagline);
      if (data.data.hero_banner?.title !== undefined) setHeroTitle(data.data.hero_banner.title);
      if (data.data.hero_banner?.subtitle !== undefined) setHeroSubtitle(data.data.hero_banner.subtitle);
      if (data.data.contacts?.whatsapp !== undefined) setContactWhatsApp(data.data.contacts.whatsapp);
      if (data.data.contacts?.email !== undefined) setContactEmail(data.data.contacts.email);
      if (data.data.announcement?.text !== undefined) setAnnouncementText(data.data.announcement.text);
      if (data.data.announcement?.is_active !== undefined) setAnnouncementActive(Boolean(data.data.announcement.is_active));
      if (data.data.apk_pos_url !== undefined) setApkPosUrl(data.data.apk_pos_url);
      if (data.data.apk_so_url !== undefined) setApkSoUrl(data.data.apk_so_url);
    }
  }, [data]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          apiClient(`/api/landlord/landing/settings/${key}`, {
            method: "PUT",
            body: JSON.stringify({ value }),
          })
        )
      );
    },
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
      apk_pos_url: apkPosUrl,
      apk_so_url: apkSoUrl,
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            Landing Page CMS &amp; On-Demand Revalidation
          </h1>
          <p className="text-xs text-muted-fg mt-1">
            Kelola konten promosi publik, FAQ, banner hero, dan pemicu invalidasi cache ISR landing page
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => revalidateMutation.mutate()}
            disabled={revalidateMutation.isPending}
            variant="primary"
            size="sm"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            <span>
              {revalidateMutation.isPending
                ? "Merevalidasi..."
                : "Purge & Revalidate Landing"}
            </span>
          </Button>

          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="neutral"
            size="sm"
            title="Segarkan data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Hero Banner Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" />
              <CardTitle>Hero Header &amp; Tagline</CardTitle>
            </div>
            <CardDescription>
              Teks utama yang tampil di area hero landing page depan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Badge / Tagline Atas"
              type="text"
              value={heroTagline}
              onChange={(e) => setHeroTagline(e.target.value)}
            />

            <Input
              label="Judul Utama (Headline H1)"
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
            />

            <div>
              <label className="block text-xs font-medium text-fg mb-1.5">
                Sub-Headline Deskripsi
              </label>
              <textarea
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-subtle resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Announcement Bar Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-warning" />
                <CardTitle>Announcement Bar (Top Bar)</CardTitle>
              </div>
              <label className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={announcementActive}
                  onChange={(e) => setAnnouncementActive(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span>Tampilkan Pengumuman</span>
              </label>
            </div>
            <CardDescription>
              Banner notifikasi berjalan di bagian paling atas seluruh halaman landing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              label="Isi Pengumuman"
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Teks berjalan promosi..."
            />
          </CardContent>
        </Card>

        {/* Contact Support Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-success" />
              <CardTitle>Kontak Customer Care &amp; CS</CardTitle>
            </div>
            <CardDescription>
              Saluran resmi bantuan untuk merchant calon tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="WhatsApp CS (Format: 628...)"
                type="text"
                value={contactWhatsApp}
                onChange={(e) => setContactWhatsApp(e.target.value)}
              />

              <Input
                label="Email CS Support"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* APK Download Links Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-info" />
              <CardTitle>Link Download Aplikasi Android</CardTitle>
            </div>
            <CardDescription>
              URL file APK yang dapat diunduh langsung dari dashboard tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="URL APK Kasir (POS)"
                  type="url"
                  value={apkPosUrl}
                  onChange={(e) => setApkPosUrl(e.target.value)}
                  placeholder="https://cdn.example.com/pos-godinov-kasir.apk"
                />
                <p className="text-[11px] text-muted-fg mt-1">
                  App kasir frontline untuk kasir counter
                </p>
              </div>

              <div>
                <Input
                  label="URL APK Sales Order (SO)"
                  type="url"
                  value={apkSoUrl}
                  onChange={(e) => setApkSoUrl(e.target.value)}
                  placeholder="https://cdn.example.com/pos-godinov-so.apk"
                />
                <p className="text-[11px] text-muted-fg mt-1">
                  App sales order untuk tim sales lapangan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            variant="primary"
            size="md"
          >
            <Save className="w-4 h-4 mr-1.5" />
            <span>{saveMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan CMS"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

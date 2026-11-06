"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Eye,
  MousePointerClick,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { ApiResponse, SaaSCampaign } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/feedback";

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

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function campaignToForm(c: SaaSCampaign): typeof DEFAULT_FORM {
  return {
    title: c.title,
    subtitle: c.subtitle ?? "",
    format: (c.format as CampaignFormat) ?? "CAROUSEL_SLIDE",
    placement: c.placement,
    image_url: c.image_url ?? "",
    action_type: (c.action_type as CampaignActionType) ?? "INFO_ONLY",
    action_url: c.action_url ?? "",
    action_label: c.action_label ?? "",
    target_tier: (c.target_tier as CampaignTargetTier) ?? "ALL",
    priority: c.priority,
    skip_delay_seconds: c.skip_delay_seconds,
    starts_at: toDatetimeLocal(c.starts_at),
    ends_at: toDatetimeLocal(c.ends_at),
    is_active: c.is_active,
  };
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landlord-campaigns"],
    queryFn: () =>
      apiClient<ApiResponse<SaaSCampaign[]>>("/api/landlord/campaigns"),
  });

  const rawCampaigns = data?.data;
  const nestedCampaigns = (rawCampaigns as { campaigns?: unknown } | undefined)?.campaigns;
  const campaigns: SaaSCampaign[] = Array.isArray(rawCampaigns)
    ? rawCampaigns
    : Array.isArray(nestedCampaigns)
    ? (nestedCampaigns as SaaSCampaign[])
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
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat kampanye");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiClient(`/api/landlord/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Kampanye berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["landlord-campaigns"] });
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui kampanye");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/landlord/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Kampanye berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["landlord-campaigns"] });
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus kampanye");
      setDeletingId(null);
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEditModal = (campaign: SaaSCampaign) => {
    setEditingId(campaign.id);
    setForm(campaignToForm(campaign));
    setModalOpen(true);
  };

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

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (field: keyof typeof DEFAULT_FORM, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            In-App Campaigns &amp; Promosi
          </h1>
          <p className="text-xs text-muted-fg mt-1">
            Manajemen banner iklan dan pop-up in-app untuk tenant merchant
          </p>
        </div>

        <Button onClick={openCreateModal} variant="primary" size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" />
          <span>Buat Kampanye Baru</span>
        </Button>
      </div>

      {/* Main Table Card */}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Judul &amp; Format</TH>
              <TH>Target Tier</TH>
              <TH>Performa (Imp/Click)</TH>
              <TH>Status &amp; Waktu</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-muted-fg">
                  <Skeleton className="h-6 w-1/2 mx-auto" />
                </TD>
              </TR>
            ) : isError ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-danger-text">
                  {(error as Error)?.message || "Gagal memuat kampanye"}
                </TD>
              </TR>
            ) : campaigns.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-8">
                  <EmptyState
                    icon={Megaphone}
                    title="Belum ada kampanye in-app"
                    description="Buat kampanye promosi untuk mengumumkan fitur baru atau upgrade paket tenant."
                    action={
                      <Button onClick={openCreateModal} variant="primary" size="sm">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Buat Kampanye
                      </Button>
                    }
                  />
                </TD>
              </TR>
            ) : (
              campaigns.map((c) => {
                const ctr =
                  c.impression_count > 0
                    ? ((c.click_count / c.impression_count) * 100).toFixed(2)
                    : "0.00";
                return (
                  <TR key={c.id}>
                    <TD>
                      <div className="font-medium text-fg">{c.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge tone="info">{c.format}</Badge>
                        <span className="text-[11px] text-muted-fg">
                          &bull; {c.placement}
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={c.target_tier === "FREE_ONLY" ? "warning" : "neutral"}>
                        {c.target_tier === "FREE_ONLY" ? "Hanya FREE" : c.target_tier}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-muted-fg" title="Tayangan (Impression)">
                          <Eye className="w-3.5 h-3.5 text-muted-fg" /> {c.impression_count}
                        </span>
                        <span className="flex items-center gap-1 text-muted-fg" title="Klik">
                          <MousePointerClick className="w-3.5 h-3.5 text-muted-fg" /> {c.click_count}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-medium text-fg">
                          {ctr}% CTR
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        {c.is_active ? (
                          <Badge tone="success">Aktif</Badge>
                        ) : (
                          <Badge tone="neutral">Nonaktif</Badge>
                        )}
                        <span className="text-[11px] text-muted-fg">
                          {formatDate(c.starts_at)}
                        </span>
                      </div>
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          onClick={() => openEditModal(c)}
                          variant="neutral"
                          size="sm"
                          title="Edit kampanye"
                          aria-label="Edit kampanye"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          onClick={() => setDeletingId(c.id)}
                          variant="danger"
                          size="sm"
                          title="Hapus kampanye"
                          aria-label="Hapus kampanye"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>

      {/* Create/Edit Campaign Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-elevated my-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-fg">
                {editingId ? "Edit Kampanye" : "Buat Kampanye Baru"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-md text-muted-fg hover:text-fg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Judul Kampanye *"
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    required
                    placeholder="Contoh: Upgrade ke Pro untuk fitur lengkap"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Subtitle (Opsional)"
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder="Deskripsi singkat kampanye"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-fg mb-1.5">Format Tampilan</label>
                  <select
                    value={form.format}
                    onChange={(e) => set("format", e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-subtle"
                  >
                    <option value="CAROUSEL_SLIDE">CAROUSEL_SLIDE</option>
                    <option value="HEADER_BANNER">HEADER_BANNER</option>
                    <option value="POPUP_MODAL">POPUP_MODAL</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Placement"
                    type="text"
                    value={form.placement}
                    onChange={(e) => set("placement", e.target.value)}
                    placeholder="dashboard, reports, products..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="URL Gambar Banner"
                    type="url"
                    value={form.image_url}
                    onChange={(e) => set("image_url", e.target.value)}
                    placeholder="https://cdn.example.com/banner.png"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-fg mb-1.5">Tipe Aksi</label>
                  <select
                    value={form.action_type}
                    onChange={(e) => set("action_type", e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-subtle"
                  >
                    <option value="INFO_ONLY">INFO_ONLY</option>
                    <option value="INTERNAL_UPGRADE">INTERNAL_UPGRADE</option>
                    <option value="EXTERNAL_URL">EXTERNAL_URL</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Label Tombol"
                    type="text"
                    value={form.action_label}
                    onChange={(e) => set("action_label", e.target.value)}
                    placeholder="Upgrade Sekarang"
                  />
                </div>

                {form.action_type !== "INFO_ONLY" && (
                  <div className="sm:col-span-2">
                    <Input
                      label="URL Aksi"
                      type="text"
                      value={form.action_url}
                      onChange={(e) => set("action_url", e.target.value)}
                      placeholder="/subscription atau https://..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-fg mb-1.5">Target Tier</label>
                  <select
                    value={form.target_tier}
                    onChange={(e) => set("target_tier", e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-subtle"
                  >
                    <option value="ALL">Semua Tier (ALL)</option>
                    <option value="FREE_ONLY">Hanya Tier Free (FREE_ONLY)</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Prioritas Urutan"
                    type="number"
                    value={form.priority}
                    onChange={(e) => set("priority", parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Input
                    label="Skip Delay (Detik)"
                    type="number"
                    value={form.skip_delay_seconds}
                    onChange={(e) => set("skip_delay_seconds", parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Input
                    label="Mulai Tayang (Opsional)"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => set("starts_at", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Selesai Tayang (Opsional)"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <label htmlFor="is_active" className="text-xs text-fg cursor-pointer select-none">
                    Aktifkan kampanye segera
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button type="button" onClick={closeModal} variant="neutral" size="sm">
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  size="sm"
                >
                  {isSubmitting
                    ? editingId
                      ? "Menyimpan..."
                      : "Membuat..."
                    : editingId
                    ? "Simpan Perubahan"
                    : "Buat Kampanye"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus Kampanye Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-elevated">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-danger-subtle text-danger-text">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-fg">Hapus Kampanye?</h2>
                <p className="text-xs text-muted-fg mt-0.5">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                onClick={() => setDeletingId(null)}
                variant="neutral"
                size="sm"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingId)}
                variant="danger"
                size="sm"
              >
                {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone,
  Plus,
  Pencil,
  Trash2,
  X,
  Copy,
  Check,
  RefreshCw,
  Search,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import {
  ApiResponse,
  POSMobileCredential,
  CreatePOSMobileCredentialPayload,
  UpdatePOSMobileCredentialPayload,
} from "@/lib/types";
import { Card, StatCard } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/feedback";

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part = (len: number) => {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `POS-${part(4)}-${part(4)}-${part(4)}`;
}

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const DEFAULT_FORM: CreatePOSMobileCredentialPayload = {
  code: "",
  label: "",
  notes: "",
  business_id: "",
  is_active: true,
  max_usage: 0,
  expires_at: "",
};

export default function POSCredentialsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [form, setForm] = useState<CreatePOSMobileCredentialPayload>(DEFAULT_FORM);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch list
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landlord-pos-credentials", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter === "ACTIVE") params.set("is_active", "true");
      if (statusFilter === "INACTIVE") params.set("is_active", "false");
      params.set("limit", "100");
      return apiClient<ApiResponse<POSMobileCredential[]>>(
        `/api/landlord/pos-credentials?${params.toString()}`
      );
    },
  });

  const credentials: POSMobileCredential[] = Array.isArray(data?.data)
    ? data.data
    : [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreatePOSMobileCredentialPayload) =>
      apiClient("/api/landlord/pos-credentials", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          business_id: payload.business_id?.trim() || undefined,
          notes: payload.notes?.trim() || undefined,
          expires_at: payload.expires_at ? new Date(payload.expires_at).toISOString() : undefined,
          max_usage: Number(payload.max_usage) || 0,
        }),
      }),
    onSuccess: () => {
      toast.success("Kredensial POS mobile berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["landlord-pos-credentials"] });
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat kredensial");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdatePOSMobileCredentialPayload;
    }) =>
      apiClient(`/api/landlord/pos-credentials/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          business_id: payload.business_id?.trim() || undefined,
          notes: payload.notes?.trim() || undefined,
          expires_at: payload.expires_at ? new Date(payload.expires_at).toISOString() : undefined,
          max_usage: Number(payload.max_usage) || 0,
        }),
      }),
    onSuccess: () => {
      toast.success("Kredensial POS mobile berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["landlord-pos-credentials"] });
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui kredensial");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/landlord/pos-credentials/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Kredensial POS mobile berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["landlord-pos-credentials"] });
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus kredensial");
    },
  });

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...DEFAULT_FORM,
      code: generateRandomCode(),
    });
    setModalOpen(true);
  };

  const openEditModal = (cred: POSMobileCredential) => {
    setEditingId(cred.id);
    setForm({
      code: cred.code,
      label: cred.label,
      notes: cred.notes || "",
      business_id: cred.business_id || "",
      is_active: cred.is_active,
      max_usage: cred.max_usage,
      expires_at: toDatetimeLocal(cred.expires_at),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success(`Kode ${code} disalin ke clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Gagal menyalin kode");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          label: form.label,
          notes: form.notes,
          business_id: form.business_id,
          is_active: form.is_active,
          max_usage: form.max_usage,
          expires_at: form.expires_at,
        },
      });
    } else {
      createMutation.mutate(form);
    }
  };

  // Stats calculation
  const totalCount = credentials.length;
  const activeCount = credentials.filter((c) => c.is_active).length;
  const totalUsages = credentials.reduce((acc, c) => acc + (c.usage_count || 0), 0);
  const inactiveOrExpiredCount = credentials.filter((c) => {
    if (!c.is_active) return true;
    if (c.expires_at && new Date(c.expires_at) < new Date()) return true;
    return false;
  }).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg flex items-center gap-2">
            <Smartphone className="size-6 text-accent" />
            Kredensial POS Mobile
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Kelola kode acak verifikasi untuk aktivasi dan autentikasi aplikasi kasir POS Mobile.
          </p>
        </div>
        <Button onClick={openCreateModal} variant="primary" size="md">
          <Plus className="size-4 mr-1.5" />
          Buat Kredensial Baru
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Kredensial"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : totalCount}
          hint="Semua kunci terminal terdaftar"
          icon={KeyRound}
        />
        <StatCard
          label="Kredensial Aktif"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : activeCount}
          hint="Dapat digunakan untuk verifikasi"
          icon={ShieldCheck}
        />
        <StatCard
          label="Total Verifikasi"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : `${totalUsages}x`}
          hint="Akumulasi verifikasi aplikasi"
          icon={Hash}
        />
        <StatCard
          label="Nonaktif / Kadaluarsa"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : inactiveOrExpiredCount}
          hint="Kunci tidak dapat digunakan"
          icon={ShieldAlert}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-muted" />
            <input
              type="text"
              placeholder="Cari berdasarkan kode, nama terminal, atau catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-muted whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
              className="h-9 px-3 bg-surface border border-border rounded-lg text-xs text-fg focus:outline-none focus:border-accent"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Hanya Aktif</option>
              <option value="INACTIVE">Hanya Nonaktif</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Credentials Table */}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Kode Verifikasi</TH>
              <TH>Label / Peruntukan</TH>
              <TH>Tenant Bisnis</TH>
              <TH>Status</TH>
              <TH>Pemakaian</TH>
              <TH>Terakhir Dipakai</TH>
              <TH>Kadaluarsa</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TR key={i}>
                  <TD><Skeleton className="h-5 w-32" /></TD>
                  <TD><Skeleton className="h-5 w-28" /></TD>
                  <TD><Skeleton className="h-5 w-20" /></TD>
                  <TD><Skeleton className="h-5 w-16" /></TD>
                  <TD><Skeleton className="h-5 w-12" /></TD>
                  <TD><Skeleton className="h-5 w-24" /></TD>
                  <TD><Skeleton className="h-5 w-24" /></TD>
                  <TD className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TD>
                </TR>
              ))
            ) : isError ? (
              <TR>
                <TD colSpan={8}>
                  <div className="py-8 text-center text-xs text-danger">
                    Gagal memuat kredensial: {(error as Error)?.message || "Terjadi kesalahan"}
                  </div>
                </TD>
              </TR>
            ) : credentials.length === 0 ? (
              <TR>
                <TD colSpan={8}>
                  <EmptyState
                    icon={KeyRound}
                    title="Belum ada kredensial POS Mobile"
                    description={
                      search
                        ? "Tidak ada kredensial yang cocok dengan kriteria pencarian."
                        : "Buat kode acak verifikasi pertama untuk memvalidasi aplikasi kasir POS."
                    }
                    action={
                      search ? (
                        <Button onClick={() => setSearch("")} variant="neutral" size="sm">
                          Reset Pencarian
                        </Button>
                      ) : (
                        <Button onClick={openCreateModal} variant="primary" size="sm">
                          <Plus className="size-3.5 mr-1" /> Buat Kredensial
                        </Button>
                      )
                    }
                  />
                </TD>
              </TR>
            ) : (
              credentials.map((cred) => {
                const isExpired = cred.expires_at && new Date(cred.expires_at) < new Date();
                const isMaxedOut = cred.max_usage > 0 && cred.usage_count >= cred.max_usage;

                return (
                  <TR key={cred.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-bg-muted border border-border px-2 py-1 rounded select-all text-fg">
                          {cred.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(cred.code, cred.id)}
                          className="p-1 rounded text-fg-muted hover:text-accent hover:bg-accent-subtle transition-colors cursor-pointer"
                          title="Salin Kode Verifikasi"
                        >
                          {copiedId === cred.id ? (
                            <Check className="size-3.5 text-success-text" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </TD>
                    <TD>
                      <div>
                        <div className="font-semibold text-fg text-xs">{cred.label}</div>
                        {cred.notes && (
                          <div className="text-[11px] text-fg-muted truncate max-w-xs">{cred.notes}</div>
                        )}
                      </div>
                    </TD>
                    <TD>
                      {cred.business_id ? (
                        <Badge tone="info" className="font-mono text-[11px]">
                          {cred.business_id}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-fg-muted">Semua Tenant</span>
                      )}
                    </TD>
                    <TD>
                      {!cred.is_active ? (
                        <Badge tone="neutral">Nonaktif</Badge>
                      ) : isExpired ? (
                        <Badge tone="warning">Kadaluarsa</Badge>
                      ) : isMaxedOut ? (
                        <Badge tone="danger">Batas Habis</Badge>
                      ) : (
                        <Badge tone="success">Aktif</Badge>
                      )}
                    </TD>
                    <TD>
                      <span className="font-mono text-xs">
                        {cred.usage_count}
                        {cred.max_usage > 0 ? ` / ${cred.max_usage}` : " kali"}
                      </span>
                    </TD>
                    <TD className="text-[11px] text-fg-muted">
                      {cred.last_used_at ? formatDate(cred.last_used_at) : "Belum pernah"}
                    </TD>
                    <TD className="text-[11px] text-fg-muted">
                      {cred.expires_at ? formatDate(cred.expires_at) : "Selamanya"}
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          onClick={() => openEditModal(cred)}
                          variant="neutral"
                          size="sm"
                          title="Edit Kredensial"
                        >
                          <Pencil className="size-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          onClick={() => setDeletingId(cred.id)}
                          variant="danger"
                          size="sm"
                          title="Hapus Kredensial"
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-elevated my-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Smartphone className="size-5 text-accent" />
                {editingId ? "Edit Kredensial POS Mobile" : "Buat Kredensial Baru"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Code field (Read-only or customizable on create) */}
              <div>
                <label className="block text-xs font-medium text-fg mb-1.5">
                  Kode Acak Verifikasi {editingId && "(Tidak dapat diubah)"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.code}
                    disabled={!!editingId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="Contoh: POS-XXXX-XXXX-XXXX"
                    className="flex-1 h-9 px-3 bg-surface border border-border rounded-md text-xs font-mono text-fg uppercase focus:outline-none focus:border-accent disabled:bg-bg-muted disabled:text-fg-muted"
                  />
                  {!editingId && (
                    <Button
                      type="button"
                      variant="neutral"
                      size="sm"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, code: generateRandomCode() }))
                      }
                      title="Acak Kode Baru"
                    >
                      <RefreshCw className="size-3.5 mr-1" />
                      Acak
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-fg-muted mt-1">
                  Format acak uppercase dengan pemisah strip untuk kemudahan input kasir.
                </p>
              </div>

              {/* Label */}
              <div>
                <Input
                  label="Label / Nama Terminal *"
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                  required
                  placeholder="Contoh: Kasir Utama Cabang Sudirman"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-fg mb-1.5">Catatan (Opsional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Keterangan tambahan untuk teknisi atau supervisor..."
                  className="w-full p-2.5 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>

              {/* Business ID limitation & Max usage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Target Bisnis ID (Opsional)"
                    type="text"
                    value={form.business_id || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, business_id: e.target.value }))
                    }
                    placeholder="Kosong = Semua tenant"
                  />
                </div>

                <div>
                  <Input
                    label="Batas Pemakaian"
                    type="number"
                    min={0}
                    value={form.max_usage}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, max_usage: parseInt(e.target.value, 10) || 0 }))
                    }
                    placeholder="0 = Tanpa batas"
                  />
                  <p className="text-[10px] text-fg-muted mt-0.5">Isi 0 untuk penggunaan tanpa batas.</p>
                </div>
              </div>

              {/* Expires At */}
              <div>
                <label className="block text-xs font-medium text-fg mb-1.5">
                  Masa Berlaku / Kadaluarsa (Opsional)
                </label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full h-9 px-3 bg-surface border border-border rounded-md text-xs text-fg focus:outline-none focus:border-accent"
                />
                <p className="text-[10px] text-fg-muted mt-0.5">Kosongkan jika kunci berlaku selamanya.</p>
              </div>

              {/* Status Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="size-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-xs font-medium text-fg">Kredensial Aktif</span>
                </label>
                <p className="text-[11px] text-fg-muted pl-6 mt-0.5">
                  Jika dinonaktifkan, aplikasi kasir tidak akan dapat memverifikasi kode ini.
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
                <Button type="button" variant="neutral" onClick={closeModal}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    "Menyimpan..."
                  ) : editingId ? (
                    "Simpan Perubahan"
                  ) : (
                    "Buat Kredensial"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-elevated">
            <h2 className="text-sm font-bold text-fg">Konfirmasi Hapus Kredensial</h2>
            <p className="text-xs text-fg-muted">
              Apakah Anda yakin ingin menghapus kredensial ini? Kunci verifikasi ini tidak akan dapat
              digunakan lagi oleh perangkat POS Mobile mana pun.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Menghapus..." : "Hapus Kredensial"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

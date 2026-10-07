"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Ban,
  RotateCcw,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatIDR, formatDate } from "@/lib/utils";
import { BusinessDetailResponse, ApiResponse } from "@/lib/types";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const businessId = params.id as string;

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideKey, setOverrideKey] = useState("");
  const [overrideType, setOverrideType] = useState("ADD_LIMIT");
  const [overrideValue, setOverrideValue] = useState("10");
  const [overrideNotes, setOverrideNotes] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tenant-detail", businessId],
    queryFn: () =>
      apiClient<ApiResponse<BusinessDetailResponse>>(
        `/api/landlord/businesses/${businessId}`
      ),
    enabled: Boolean(businessId),
  });

  const detail = data?.data;

  // Suspend Mutation
  const suspendMutation = useMutation({
    mutationFn: (reason: string) =>
      apiClient(`/api/landlord/businesses/${businessId}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success("Akun bisnis berhasil dibekukan");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
      setSuspendModalOpen(false);
      setSuspendReason("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membekukan akun bisnis");
    },
  });

  // Unsuspend Mutation
  const unsuspendMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/landlord/businesses/${businessId}/unsuspend`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Akun bisnis berhasil diaktifkan kembali");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal mengaktifkan akun");
    },
  });

  // Impersonate Mutation
  const impersonateMutation = useMutation({
    mutationFn: () =>
      apiClient<ApiResponse<{ impersonation_token: string; redirect_url?: string }>>(
        `/api/landlord/businesses/${businessId}/impersonate`,
        { method: "POST" }
      ),
    onSuccess: (resp) => {
      const token = resp.data?.impersonation_token;
      toast.success("Token impersonasi berhasil diterbitkan!");
      if (token) {
        // Tampilkan prompt atau buka POS Merchant
        const frontendUrl =
          process.env.NEXT_PUBLIC_MERCHANT_FE_URL || "http://localhost:3000";
        window.open(
          `${frontendUrl}/impersonate-login?token=${token}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat sesi impersonasi");
    },
  });

  // Add Override Mutation
  const addOverrideMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient(`/api/landlord/businesses/${businessId}/overrides`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Custom feature override berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
      setOverrideModalOpen(false);
      setOverrideKey("");
      setOverrideNotes("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyimpan override");
    },
  });

  // Delete Override Mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (featureKey: string) =>
      apiClient(
        `/api/landlord/businesses/${businessId}/overrides?feature_key=${encodeURIComponent(
          featureKey
        )}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      toast.success("Override kuota dihapus");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus override");
    },
  });

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideKey.trim()) {
      toast.error("Feature key wajib diisi");
      return;
    }

    const payload: Record<string, unknown> = {
      feature_key: overrideKey.trim(),
      override_type: overrideType,
      notes: overrideNotes.trim() || undefined,
    };

    if (overrideType === "ENABLE_FLAG" || overrideType === "DISABLE_FLAG") {
      payload.value_bool = overrideType === "ENABLE_FLAG";
    } else {
      payload.value_numeric = parseInt(overrideValue, 10) || 0;
    }

    addOverrideMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-zinc-500 text-xs">
        Memuat detail tenant 360...
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Direktori
        </Link>
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {(error as Error)?.message || "Bisnis tidak ditemukan atau terjadi kesalahan"}
        </div>
      </div>
    );
  }

  const { business, subscription, wallet, overrides, effective_policy } = detail;
  const isSuspended = business.status === "SUSPENDED";

  return (
    <div className="space-y-6">
      {/* Top Nav & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Direktori</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => impersonateMutation.mutate()}
            disabled={impersonateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {impersonateMutation.isPending
                ? "Menerbitkan Token..."
                : "Impersonate (Masuk sebagai Merchant)"}
            </span>
          </button>

          {isSuspended ? (
            <button
              onClick={() => unsuspendMutation.mutate()}
              disabled={unsuspendMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pulihkan (Unsuspend)</span>
            </button>
          ) : (
            <button
              onClick={() => setSuspendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Bekukan Akun (Suspend)</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Profile Card */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-zinc-100">{business.name}</h1>
              {isSuspended ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                  SUSPENDED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400 mt-1 font-mono">
              <span>Serial: {business.serial_business}</span>
              <span>•</span>
              <span>Owner: {business.owner_name} ({business.email})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-[11px] text-zinc-500">Paket Aktif</div>
            <div className="text-sm font-semibold uppercase text-indigo-400 mt-0.5">
              {subscription?.plan?.name || "FREE PLAN"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Kadaluwarsa: {formatDate(subscription?.expires_at)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-zinc-500">Saldo Wallet Merchant</div>
            <div className="text-sm font-mono font-semibold text-emerald-400 mt-0.5">
              {formatIDR(wallet?.balance_minor || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
              Held: {formatIDR(wallet?.held_balance_minor || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Feature Policy & Overrides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Effective Policy */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Effective SaaS Policy (Evaluated)</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Numeric Limits */}
            <div>
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Batas Kuota Numerik
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(effective_policy?.numeric_limit || {}).map(
                  ([key, val]) => (
                    <div
                      key={key}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="font-mono text-zinc-400 text-[11px]">
                        {key}
                      </span>
                      <span className="font-mono font-semibold text-zinc-100">
                        {val === -1 ? "Unlimited (∞)" : val}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Boolean Flags */}
            <div>
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Status Fitur Boolean
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(effective_policy?.boolean_feature || {}).map(
                  ([key, enabled]) => (
                    <div
                      key={key}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="font-mono text-zinc-400 text-[11px]">
                        {key}
                      </span>
                      {enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Feature Overrides */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Custom Feature Overrides</span>
            </div>
            <button
              onClick={() => setOverrideModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Override</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {!overrides || overrides.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Tidak ada kustomisasi khusus untuk tenant ini.
              </div>
            ) : (
              overrides.map((ov) => (
                <div
                  key={ov.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-mono font-semibold text-indigo-300">
                      {ov.feature_key}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Tipe: <span className="text-zinc-300">{ov.override_type}</span>{" "}
                      • Nilai:{" "}
                      <span className="font-mono font-semibold text-zinc-200">
                        {ov.value_numeric !== undefined
                          ? ov.value_numeric
                          : ov.value_bool
                          ? "TRUE"
                          : "FALSE"}
                      </span>
                    </div>
                    {ov.notes && (
                      <div className="text-[10px] text-zinc-500 italic mt-0.5">
                        Catatan: {ov.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteOverrideMutation.mutate(ov.feature_key)}
                    disabled={deleteOverrideMutation.isPending}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Suspend */}
      {suspendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h2 className="text-base font-bold text-zinc-100">
                Bekukan Akun Tenant
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Tenant yang dibekukan tidak akan dapat memproses transaksi POS atau mengakses dasbor merchant hingga status dipulihkan.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Alasan Pembekuan
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Contoh: Menunggak pembayaran invoice dunning atau pelanggaran TOS..."
                className="w-full h-24 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => suspendMutation.mutate(suspendReason)}
                disabled={suspendMutation.isPending}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {suspendMutation.isPending ? "Membekukan..." : "Konfirmasi Pembekuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Override */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-zinc-100">
              Tambah Kustomisasi Kuota / Fitur
            </h2>
            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Feature Key
                </label>
                <input
                  type="text"
                  placeholder="max_outlets, max_products, inventory_ledger..."
                  value={overrideKey}
                  onChange={(e) => setOverrideKey(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tipe Override
                </label>
                <select
                  value={overrideType}
                  onChange={(e) => setOverrideType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ADD_LIMIT">ADD_LIMIT (Tambah dari kuota paket)</option>
                  <option value="SET_LIMIT">SET_LIMIT (Tetapkan nilai pasti)</option>
                  <option value="ENABLE_FLAG">ENABLE_FLAG (Aktifkan fitur boolean)</option>
                  <option value="DISABLE_FLAG">DISABLE_FLAG (Nonaktifkan fitur boolean)</option>
                </select>
              </div>

              {overrideType === "ADD_LIMIT" || overrideType === "SET_LIMIT" ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Nilai Numerik (-1 untuk Unlimited)
                  </label>
                  <input
                    type="number"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Promo onboarding VIP cabang baru"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addOverrideMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {addOverrideMutation.isPending ? "Menyimpan..." : "Simpan Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

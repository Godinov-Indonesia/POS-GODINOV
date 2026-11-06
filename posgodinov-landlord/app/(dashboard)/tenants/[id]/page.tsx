"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ShieldAlert,
  UserCheck,
  Ban,
  RotateCcw,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Sliders,
  Layers,
  Save,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  BusinessDetailResponse,
  ApiResponse,
  Plan,
  SaaSFeature,
} from "@/lib/types";

const FALLBACK_FEATURES: SaaSFeature[] = [
  { key: "max_outlets", name: "Maksimal Outlet", description: "", category: "CORE", value_type: "NUMERIC_LIMIT", unit: "Outlet", sort_order: 1, is_active: true, created_at: "" },
  { key: "max_products", name: "Maksimal Produk", description: "", category: "CORE", value_type: "NUMERIC_LIMIT", unit: "Produk", sort_order: 2, is_active: true, created_at: "" },
  { key: "max_raw_materials", name: "Maksimal Bahan Baku", description: "", category: "INVENTORY", value_type: "NUMERIC_LIMIT", unit: "Bahan", sort_order: 3, is_active: true, created_at: "" },
  { key: "max_staff_per_outlet", name: "Maksimal Staf Kasir", description: "", category: "STAFF", value_type: "NUMERIC_LIMIT", unit: "Staf", sort_order: 4, is_active: true, created_at: "" },
  { key: "history_days_limit", name: "Batas Riwayat Laporan", description: "", category: "REPORTS", value_type: "NUMERIC_LIMIT", unit: "Hari", sort_order: 5, is_active: true, created_at: "" },
  { key: "cloud_storage_mb", name: "Kapasitas Penyimpanan Gambar", description: "", category: "CORE", value_type: "NUMERIC_LIMIT", unit: "MB", sort_order: 6, is_active: true, created_at: "" },
  { key: "staff_transfer", name: "Transfer Staf Antar Outlet", description: "", category: "STAFF", value_type: "BOOLEAN_FLAG", sort_order: 7, is_active: true, created_at: "" },
  { key: "export_reports", name: "Ekspor Laporan Excel/CSV/PDF", description: "", category: "REPORTS", value_type: "BOOLEAN_FLAG", sort_order: 8, is_active: true, created_at: "" },
  { key: "stock_opname_collaborative", name: "Stock Opname Kolaboratif", description: "", category: "INVENTORY", value_type: "BOOLEAN_FLAG", sort_order: 9, is_active: true, created_at: "" },
  { key: "dual_stock_auto_unpack", name: "Dual-Stock & Auto-Unpack", description: "", category: "INVENTORY", value_type: "BOOLEAN_FLAG", sort_order: 10, is_active: true, created_at: "" },
  { key: "custom_branding", name: "Kustomisasi Logo Struk & Nota", description: "", category: "CORE", value_type: "BOOLEAN_FLAG", sort_order: 11, is_active: true, created_at: "" },
  { key: "api_webhook_access", name: "Akses REST API & Webhooks", description: "", category: "INTEGRATION", value_type: "BOOLEAN_FLAG", sort_order: 12, is_active: true, created_at: "" },
  { key: "no_ads", name: "Bebas Iklan (Ad-Free)", description: "", category: "CORE", value_type: "BOOLEAN_FLAG", sort_order: 13, is_active: true, created_at: "" },
];

const FALLBACK_PLANS: Plan[] = [
  { id: "plan_free", code: "FREE", name: "Free Tier (Starter)", description: "Paket gratis permanen 1 outlet", price_minor: 0, billing_cycle: "LIFETIME", is_public: true, is_active: true, sort_order: 1, created_at: "", updated_at: "" },
  { id: "plan_pro_monthly", code: "PRO", name: "Pro Growth Monthly", description: "Paket Pro Bulanan", price_minor: 14900000, billing_cycle: "MONTHLY", is_public: true, is_active: true, sort_order: 2, created_at: "", updated_at: "" },
  { id: "plan_pro_yearly", code: "PRO", name: "Pro Growth Yearly", description: "Paket Pro Tahunan (Hemat 2 Bulan)", price_minor: 149000000, billing_cycle: "YEARLY", is_public: true, is_active: true, sort_order: 3, created_at: "", updated_at: "" },
  { id: "plan_enterprise", code: "ENTERPRISE", name: "Enterprise Unlimited Monthly", description: "Paket Enterprise Bulanan", price_minor: 0, billing_cycle: "MONTHLY", is_public: true, is_active: true, sort_order: 4, created_at: "", updated_at: "" },
  { id: "plan_enterprise_yearly", code: "ENTERPRISE", name: "Enterprise Unlimited Yearly", description: "Paket Enterprise Tahunan", price_minor: 0, billing_cycle: "YEARLY", is_public: true, is_active: true, sort_order: 5, created_at: "", updated_at: "" },
];

export default function TenantDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const businessId = params.id as string;

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  // Plan & Subscription Override state
  const [selectedTier, setSelectedTier] = useState<"FREE" | "PRO" | "ENTERPRISE">("FREE");
  const [selectedCycle, setSelectedCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");
  const [subReason, setSubReason] = useState("");

  // Enterprise By-Key Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideKey, setOverrideKey] = useState("max_outlets");
  const [overrideType, setOverrideType] = useState("SET_LIMIT");
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

  const { data: plansData } = useQuery({
    queryKey: ["landlord-plans"],
    queryFn: () => apiClient<ApiResponse<Plan[]>>("/api/landlord/plans"),
  });

  const { data: featuresData } = useQuery({
    queryKey: ["landlord-features"],
    queryFn: () => apiClient<ApiResponse<SaaSFeature[]>>("/api/landlord/features"),
  });

  const availablePlans = useMemo(() => {
    const raw = plansData?.data;
    if (!raw || raw.length === 0) return FALLBACK_PLANS;
    const map = new Map<string, Plan>();
    FALLBACK_PLANS.forEach((p) => map.set(p.id, p));
    raw.forEach((p) => map.set(p.id, p));
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [plansData]);

  const availableFeatures = useMemo(() => {
    const raw = featuresData?.data;
    return raw && raw.length > 0 ? raw : FALLBACK_FEATURES;
  }, [featuresData]);

  const detail = data?.data;

  // Sinkronkan state form dengan data langganan aktif tenant
  useEffect(() => {
    if (!detail) return;
    setOptimisticStatus(null);

    const status = (
      detail.subscription?.status ||
      detail.effective_policy?.status ||
      detail.business?.status ||
      "ACTIVE"
    ).toUpperCase();
    setSelectedStatus(status);

    const planCode = (
      detail.subscription?.plan?.code ||
      detail.effective_policy?.plan_code ||
      "FREE"
    ).toUpperCase();
    if (planCode.startsWith("ENTERPRISE")) {
      setSelectedTier("ENTERPRISE");
    } else if (planCode.startsWith("PRO")) {
      setSelectedTier("PRO");
    } else {
      setSelectedTier("FREE");
    }

    const cycle = (
      detail.subscription?.plan?.billing_cycle ||
      (detail.subscription?.plan_id?.includes("yearly") ? "YEARLY" : "MONTHLY")
    ).toUpperCase();
    setSelectedCycle(cycle === "YEARLY" ? "YEARLY" : "MONTHLY");
  }, [detail]);

  const resolvedPlan = useMemo(() => {
    if (selectedTier === "FREE") {
      return (
        availablePlans.find((p) => p.code.toUpperCase() === "FREE") ||
        FALLBACK_PLANS[0]
      );
    }
    const match = availablePlans.find(
      (p) =>
        p.code.toUpperCase().startsWith(selectedTier) &&
        p.billing_cycle.toUpperCase() === selectedCycle
    );
    if (match) return match;
    if (selectedTier === "PRO") {
      return selectedCycle === "YEARLY" ? FALLBACK_PLANS[2] : FALLBACK_PLANS[1];
    }
    return selectedCycle === "YEARLY" ? FALLBACK_PLANS[4] : FALLBACK_PLANS[3];
  }, [availablePlans, selectedTier, selectedCycle]);

  // Suspend Mutation
  const suspendMutation = useMutation({
    mutationFn: (reason: string) =>
      apiClient(`/api/landlord/businesses/${businessId}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success("Akun bisnis berhasil dibekukan (SUSPENDED)");
      setOptimisticStatus("SUSPENDED");
      setSelectedStatus("SUSPENDED");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
      queryClient.invalidateQueries({ queryKey: ["landlord-tenants"] });
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
      toast.success("Akun bisnis berhasil diaktifkan kembali (ACTIVE)");
      setOptimisticStatus("ACTIVE");
      setSelectedStatus("ACTIVE");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
      queryClient.invalidateQueries({ queryKey: ["landlord-tenants"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal mengaktifkan akun");
    },
  });

  // Update Subscription (Plan + Billing Cycle + Status) Mutation
  const updateSubMutation = useMutation({
    mutationFn: (payload: { plan_id: string; status: string; reason?: string }) =>
      apiClient(`/api/landlord/businesses/${businessId}/subscription`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, variables) => {
      toast.success("Paket langganan & status tenant berhasil diperbarui");
      setOptimisticStatus(variables.status);
      setSubReason("");
      queryClient.invalidateQueries({ queryKey: ["tenant-detail", businessId] });
      queryClient.invalidateQueries({ queryKey: ["landlord-tenants"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui langganan tenant");
    },
  });

  // Impersonate Mutation
  const impersonateMutation = useMutation({
    mutationFn: () =>
      apiClient<
        ApiResponse<{
          access_token?: string;
          impersonation_token?: string;
          refresh_token?: string;
          redirect_url?: string;
          business?: Record<string, unknown>;
        }>
      >(`/api/landlord/businesses/${businessId}/impersonate`, { method: "POST" }),
    onSuccess: (resp) => {
      const data = resp.data;
      const token = data?.access_token || data?.impersonation_token;
      if (!token) {
        toast.error("Gagal membuat sesi impersonasi");
        return;
      }

      toast.success("Token impersonasi berhasil diterbitkan!");

      const configuredFeUrl = (
        process.env.NEXT_PUBLIC_MERCHANT_FE_URL ||
        process.env.NEXT_PUBLIC_FRONTEND_URL ||
        ""
      ).replace(/\/$/, "");

      const params = new URLSearchParams();
      params.set("token", token);
      if (data?.refresh_token) {
        params.set("refresh_token", data.refresh_token);
      }
      if (data?.business) {
        params.set("business", JSON.stringify(data.business));
      }

      let targetUrl: string;
      if (configuredFeUrl) {
        // Prioritaskan URL FE dari .env Landlord jika dikonfigurasi
        targetUrl = `${configuredFeUrl}/impersonate?${params.toString()}`;
      } else if (data?.redirect_url) {
        targetUrl = data.redirect_url;
      } else {
        targetUrl = `http://localhost:3000/impersonate?${params.toString()}`;
      }

      window.open(targetUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat sesi impersonasi");
    },
  });

  // Add Override Mutation (Enterprise By-Key)
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
      setOverrideNotes("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyimpan override");
    },
  });

  // Delete Override Mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (overrideId: string) =>
      apiClient(
        `/api/landlord/businesses/${businessId}/overrides/${encodeURIComponent(overrideId)}`,
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

  const handleSaveSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    updateSubMutation.mutate({
      plan_id: resolvedPlan.id,
      status: selectedStatus,
      reason: subReason.trim() || `Diubah via Tenant 360 ke ${resolvedPlan.name} (${selectedStatus})`,
    });
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideKey.trim()) {
      toast.error("Feature key wajib dipilih");
      return;
    }

    const payload: Record<string, unknown> = {
      feature_key: overrideKey.trim(),
      override_type: overrideType,
      reason: overrideNotes.trim() || undefined,
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
  const currentStatus = (
    optimisticStatus ||
    subscription?.status ||
    effective_policy?.status ||
    business?.status ||
    "ACTIVE"
  ).toUpperCase();
  const isSuspended = currentStatus === "SUSPENDED";

  const activePlanCode = (
    subscription?.plan?.code ||
    effective_policy?.plan_code ||
    "FREE"
  ).toUpperCase();
  const isEnterpriseMode =
    selectedTier === "ENTERPRISE" || activePlanCode.startsWith("ENTERPRISE");

  const selectedFeatureMeta = availableFeatures.find((f) => f.key === overrideKey);

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
              <span>
                {unsuspendMutation.isPending
                  ? "Memulihkan..."
                  : "Pulihkan Akun (Unsuspend)"}
              </span>
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
                  {currentStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400 mt-1 font-mono">
              <span>Serial: {business.serial_business}</span>
              <span>•</span>
              <span>
                Owner: {business.owner_name} ({business.email})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-[11px] text-zinc-500">Paket Aktif</div>
            <div className="text-sm font-semibold uppercase text-indigo-400 mt-0.5">
              {subscription?.plan?.name || effective_policy?.plan_name || "FREE PLAN"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Siklus: {subscription?.plan?.billing_cycle || "LIFETIME"} • Kadaluwarsa:{" "}
              {formatDate(subscription?.expires_at)}
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

      {/* Grid: Effective Policy & Plan/Feature Override */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Effective Policy */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Effective SaaS Policy (Evaluated)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                isSuspended
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              }`}
            >
              {effective_policy?.plan_code || activePlanCode} • {currentStatus}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Numeric Limits */}
            <div>
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Batas Kuota Numerik
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(effective_policy?.numeric_limits || {}).map(
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
                {Object.entries(effective_policy?.boolean_flags || {}).map(
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

        {/* Plan, Billing Cycle, Status & Enterprise Key Overrides */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
          {/* 1. Plan & Status Selector */}
          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Override Paket Langganan & Status Tenant</span>
              </div>
            </div>

            {/* Tier Selector */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                1. Pilih Tier Paket
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["FREE", "PRO", "ENTERPRISE"] as const).map((tier) => {
                  const active = selectedTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {tier === "FREE"
                        ? "FREE (Starter)"
                        : tier === "PRO"
                        ? "PRO Growth"
                        : "ENTERPRISE"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Cycle (Monthly vs Annually) & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  2. Siklus Tagihan (Billing Cycle)
                </label>
                {selectedTier === "FREE" ? (
                  <div className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400">
                    LIFETIME (Gratis Permanen)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-zinc-950 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setSelectedCycle("MONTHLY")}
                      className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        selectedCycle === "MONTHLY"
                          ? "bg-indigo-600 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCycle("YEARLY")}
                      className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        selectedCycle === "YEARLY"
                          ? "bg-indigo-600 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Annually (Yearly)
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  3. Status Operasional
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE (Aktif Normal)</option>
                  <option value="TRIAL">TRIAL (Masa Uji Coba)</option>
                  <option value="PAST_DUE">PAST_DUE (Menunggak / Grace Period)</option>
                  <option value="SUSPENDED">SUSPENDED (Dibekukan / Blokir Login)</option>
                  <option value="EXPIRED">EXPIRED (Kadaluwarsa)</option>
                </select>
              </div>
            </div>

            {/* Selected Plan Summary & Reason */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400">Target Plan: </span>
                <span className="font-semibold text-zinc-100">
                  {resolvedPlan.name}
                </span>
                <span className="ml-2 font-mono text-[11px] text-indigo-400">
                  ({resolvedPlan.id})
                </span>
              </div>
              <div className="font-mono font-semibold text-emerald-400">
                {resolvedPlan.price_minor > 0
                  ? `${formatIDR(resolvedPlan.price_minor)} / ${resolvedPlan.billing_cycle}`
                  : resolvedPlan.code === "ENTERPRISE"
                  ? `Custom / ${resolvedPlan.billing_cycle}`
                  : "Gratis"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Catatan perubahan paket/status (opsional)..."
                value={subReason}
                onChange={(e) => setSubReason(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={updateSubMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {updateSubMutation.isPending
                    ? "Menyimpan..."
                    : "Simpan Paket & Status"}
                </span>
              </button>
            </div>
          </form>

          {/* 2. Custom Feature Overrides By Key (Khusus Enterprise) */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>Custom Feature Overrides (By Key — Khusus Enterprise)</span>
              </div>
              {isEnterpriseMode ? (
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Override Key</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Lock className="w-3 h-3" /> Khusus Enterprise
                </span>
              )}
            </div>

            {!isEnterpriseMode && (
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-[11px] text-zinc-400">
                Kustomisasi granular per <code className="text-indigo-300 font-mono">feature_key</code> hanya aktif apabila tier paket diatur ke{" "}
                <span className="font-semibold text-zinc-200">ENTERPRISE</span>. Untuk tier{" "}
                <span className="font-semibold text-zinc-200">FREE</span> dan{" "}
                <span className="font-semibold text-zinc-200">PRO</span>, batas kuota mengikuti matriks paket yang dipilih di atas.
              </div>
            )}

            <div className="space-y-2 text-xs">
              {!overrides || overrides.length === 0 ? (
                <div className="py-6 text-center text-zinc-500 text-xs">
                  Tidak ada override kustom per key untuk tenant ini.
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
                            ? ov.value_numeric === -1
                              ? "Unlimited (-1)"
                              : ov.value_numeric
                            : ov.value_bool
                            ? "TRUE"
                            : "FALSE"}
                        </span>
                      </div>
                      {ov.reason && (
                        <div className="text-[10px] text-zinc-500 italic mt-0.5">
                          Catatan: {ov.reason}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => deleteOverrideMutation.mutate(ov.id)}
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

      {/* Modal Add Override By Key (Enterprise) */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-zinc-100">
              Tambah Override Fitur Enterprise (By Key)
            </h2>
            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Pilih Feature Key
                </label>
                <select
                  value={overrideKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setOverrideKey(key);
                    const feat = availableFeatures.find((f) => f.key === key);
                    if (feat?.value_type === "BOOLEAN_FLAG") {
                      setOverrideType("ENABLE_FLAG");
                    } else {
                      setOverrideType("SET_LIMIT");
                    }
                  }}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableFeatures.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.key} — {f.name} ({f.value_type === "NUMERIC_LIMIT" ? "Kuota" : "Saklar"})
                    </option>
                  ))}
                </select>
                {selectedFeatureMeta && (
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Kategori: {selectedFeatureMeta.category}
                    {selectedFeatureMeta.unit ? ` • Satuan: ${selectedFeatureMeta.unit}` : ""}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tipe Override
                </label>
                <select
                  value={overrideType}
                  onChange={(e) => setOverrideType(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="SET_LIMIT">SET_LIMIT (Tetapkan nilai kuota pasti)</option>
                  <option value="ADD_LIMIT">ADD_LIMIT (Tambah dari kuota paket)</option>
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
                  Catatan / Kontrak Enterprise
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kontrak SLA Enterprise 25 cabang"
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

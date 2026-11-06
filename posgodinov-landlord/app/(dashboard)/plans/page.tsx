"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatIDR } from "@/lib/utils";
import { Plan, ApiResponse, UpdatePlanPayload } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

export default function PlanMatrixPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["landlord-plans"],
    queryFn: () => apiClient<ApiResponse<Plan[]>>("/api/landlord/plans"),
  });

  const plans = data?.data || [];

  // Local state for edits: planId -> featureKey -> { is_enabled: boolean, limit_value: number }
  const [editedMatrix, setEditedMatrix] = useState<
    Record<string, Record<string, { is_enabled: boolean; limit_value: number }>>
  >({});

  // Local state for editing plan price & info
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<{
    name: string;
    description: string;
    price_minor: number;
    billing_cycle: string;
    is_public: boolean;
    is_active: boolean;
  }>({
    name: "",
    description: "",
    price_minor: 0,
    billing_cycle: "MONTHLY",
    is_public: true,
    is_active: true,
  });

  const handleOpenEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditPlanForm({
      name: plan.name,
      description: plan.description || "",
      price_minor: plan.price_minor,
      billing_cycle: plan.billing_cycle || "MONTHLY",
      is_public: plan.is_public,
      is_active: plan.is_active,
    });
  };

  const updatePlanMutation = useMutation({
    mutationFn: async ({
      planId,
      payload,
    }: {
      planId: string;
      payload: UpdatePlanPayload;
    }) => {
      return apiClient<ApiResponse<Plan>>(`/api/landlord/plans/${planId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Harga dan konfigurasi paket berhasil diperbarui!");
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ["landlord-plans"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui harga paket");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      planId,
      features,
    }: {
      planId: string;
      features: { feature_key: string; is_enabled: boolean; limit_value: number }[];
    }) => {
      await Promise.all(
        features.map((f) =>
          apiClient(`/api/landlord/plans/${planId}/features/${f.feature_key}`, {
            method: "PUT",
            body: JSON.stringify({
              is_enabled: f.is_enabled,
              limit_value: f.limit_value,
              extra_config: {},
            }),
          })
        )
      );
    },
    onSuccess: () => {
      toast.success("Matriks fitur paket berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["landlord-plans"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui fitur paket");
    },
  });

  // Extract all unique feature keys across all plans
  const allFeatureKeysSet = new Set<string>();
  plans.forEach((plan) => {
    plan.features?.forEach((f) => allFeatureKeysSet.add(f.feature_key));
  });

  const fallbackKeys = [
    "max_outlets",
    "max_products",
    "inventory_ledger",
    "multi_outlet",
    "cloud_backup",
    "loyalty_points",
    "tax_configuration",
    "kitchen_display",
  ];

  const featureKeys =
    allFeatureKeysSet.size > 0
      ? Array.from(allFeatureKeysSet)
      : fallbackKeys;

  const getFeatureValue = (plan: Plan, key: string) => {
    if (editedMatrix[plan.id]?.[key]) {
      return editedMatrix[plan.id][key];
    }
    const pf = plan.features?.find((f) => f.feature_key === key);
    return {
      is_enabled: pf ? pf.is_enabled : false,
      limit_value: pf ? pf.limit_value : 0,
    };
  };

  const handleToggle = (planId: string, key: string, currentEnabled: boolean) => {
    setEditedMatrix((prev) => {
      const planEdits = { ...(prev[planId] || {}) };
      const current = planEdits[key] || getFeatureValue(plans.find((p) => p.id === planId)!, key);
      planEdits[key] = {
        ...current,
        is_enabled: !currentEnabled,
      };
      return { ...prev, [planId]: planEdits };
    });
  };

  const handleLimitChange = (planId: string, key: string, value: number) => {
    setEditedMatrix((prev) => {
      const planEdits = { ...(prev[planId] || {}) };
      const current = planEdits[key] || getFeatureValue(plans.find((p) => p.id === planId)!, key);
      planEdits[key] = {
        ...current,
        limit_value: value,
      };
      return { ...prev, [planId]: planEdits };
    });
  };

  const handleSavePlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const featuresToSave = featureKeys.map((key) => {
      const val = getFeatureValue(plan, key);
      return {
        feature_key: key,
        is_enabled: val.is_enabled,
        limit_value: val.limit_value,
      };
    });

    updateMutation.mutate({ planId, features: featuresToSave });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            SaaS Plan & Feature Matrix Editor
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Konfigurasi batas kuota numerik, toggle flag fitur, dan tarif harga di seluruh tier paket.
          </p>
        </div>

        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="neutral"
          size="sm"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Muat Ulang</span>
        </Button>
      </div>

      <Banner tone="info">
        <div className="flex items-start gap-2.5">
          <Info className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Catatan Kebijakan:</span> Limit bernilai{" "}
            <code className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[11px] text-fg font-semibold">
              -1
            </code>{" "}
            merepresentasikan kuota Unlimited (∞). Perubahan pada paket akan langsung terpropagasi ke in-memory policy cache backend.
          </div>
        </div>
      </Banner>

      {isLoading ? (
        <div className="py-20 text-center text-fg-muted text-xs">
          Memuat matriks paket & fitur...
        </div>
      ) : isError ? (
        <Banner tone="danger">
          {(error as Error)?.message || "Gagal memuat daftar paket"}
        </Banner>
      ) : plans.length === 0 ? (
        <Card className="py-20 text-center text-fg-subtle text-xs">
          Belum ada paket langganan yang terdaftar.
        </Card>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-muted border-b border-border">
                <th className="py-4 px-4 font-semibold text-fg-muted w-64 uppercase tracking-wider text-[11px]">
                  Fitur & Kuota SaaS
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    className="py-4 px-4 font-semibold text-center min-w-[220px]"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-fg font-bold uppercase tracking-wider">
                        {plan.name}
                      </span>
                      {!plan.is_active && (
                        <Badge tone="danger">Nonaktif</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-xs font-mono text-accent font-semibold">
                        {formatIDR(plan.price_minor)}
                      </span>
                      <span className="text-[10px] text-fg-subtle font-normal">
                        / {plan.billing_cycle?.toLowerCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-1 text-fg-subtle hover:text-accent hover:bg-bg-muted rounded transition-colors cursor-pointer"
                        title="Ubah harga & informasi paket"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-2.5">
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleOpenEditPlan(plan)}
                      >
                        <Pencil className="size-3" />
                        <span>Edit Harga</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSavePlan(plan.id)}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="size-3" />
                        <span>Simpan Fitur</span>
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {featureKeys.map((key) => {
                const isNumeric = key.startsWith("max_") || key.includes("limit") || key.includes("storage");

                return (
                  <tr
                    key={key}
                    className="hover:bg-bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-fg">
                        {key}
                      </div>
                      <div className="text-[10px] text-fg-subtle">
                        {isNumeric ? "Batas kuota numerik" : "Fitur saklar (boolean)"}
                      </div>
                    </td>

                    {plans.map((plan) => {
                      const val = getFeatureValue(plan, key);

                      return (
                        <td
                          key={`${plan.id}-${key}`}
                          className="py-3 px-4 text-center align-middle"
                        >
                          {isNumeric ? (
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                value={val.limit_value}
                                onChange={(e) =>
                                  handleLimitChange(
                                    plan.id,
                                    key,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className="w-24 text-center font-mono"
                              />
                              <span className="text-[10px] text-fg-subtle font-mono">
                                {val.limit_value === -1 ? "(∞)" : ""}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggle(plan.id, key, val.is_enabled)
                              }
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                val.is_enabled
                                  ? "bg-success-subtle text-success-text border-success-text/30 hover:bg-success/20"
                                  : "bg-bg-muted text-fg-subtle border-border hover:bg-bg-muted/80"
                              }`}
                            >
                              {val.is_enabled ? (
                                <>
                                  <CheckCircle2 className="size-3.5 text-success" />
                                  <span>Aktif</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-3.5 text-fg-subtle" />
                                  <span>Nonaktif</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Edit Harga & Konfigurasi Paket */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-elevated animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span>Edit Harga & Konfigurasi Paket</span>
                  <Badge tone="info">
                    {editingPlan.code}
                  </Badge>
                </h2>
                <p className="text-[11px] text-fg-muted mt-0.5">
                  Perubahan harga dan status tier paket SaaS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-fg-subtle hover:text-fg p-1 rounded-lg hover:bg-bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updatePlanMutation.mutate({
                  planId: editingPlan.id,
                  payload: editPlanForm,
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-fg font-medium mb-1">
                  Nama Paket
                </label>
                <Input
                  type="text"
                  required
                  value={editPlanForm.name}
                  onChange={(e) =>
                    setEditPlanForm({ ...editPlanForm, name: e.target.value })
                  }
                  placeholder="Contoh: Pro Tier"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-fg font-medium">
                    Harga Paket (Rupiah)
                  </label>
                  <span className="text-accent font-mono font-semibold text-[11px]">
                    {formatIDR(editPlanForm.price_minor)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-fg-subtle font-mono text-xs">
                    Rp
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={editPlanForm.price_minor}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        price_minor: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="pl-9 font-mono"
                    placeholder="0"
                  />
                </div>
                <p className="text-[10px] text-fg-subtle mt-1">
                  Isi 0 untuk paket gratis / perkenalan.
                </p>
              </div>

              <div>
                <label className="block text-fg font-medium mb-1">
                  Siklus Tagihan (Billing Cycle)
                </label>
                <select
                  value={editPlanForm.billing_cycle}
                  onChange={(e) =>
                    setEditPlanForm({
                      ...editPlanForm,
                      billing_cycle: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-accent"
                >
                  <option value="MONTHLY">Bulanan (MONTHLY)</option>
                  <option value="YEARLY">Tahunan (YEARLY)</option>
                  <option value="LIFETIME">Seumur Hidup (LIFETIME)</option>
                </select>
              </div>

              <div>
                <label className="block text-fg font-medium mb-1">
                  Deskripsi Ringkas
                </label>
                <textarea
                  rows={2}
                  value={editPlanForm.description}
                  onChange={(e) =>
                    setEditPlanForm({
                      ...editPlanForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-accent resize-none"
                  placeholder="Keterangan tier paket..."
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-border">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPlanForm.is_public}
                      onChange={(e) =>
                        setEditPlanForm({
                          ...editPlanForm,
                          is_public: e.target.checked,
                        })
                      }
                      className="rounded border-border text-accent focus:ring-0 cursor-pointer"
                    />
                    <span className="text-fg text-xs">Publik</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPlanForm.is_active}
                      onChange={(e) =>
                        setEditPlanForm({
                          ...editPlanForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="rounded border-border text-accent focus:ring-0 cursor-pointer"
                    />
                    <span className="text-fg text-xs">Aktif</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => setEditingPlan(null)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={updatePlanMutation.isPending}
                  >
                    {updatePlanMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

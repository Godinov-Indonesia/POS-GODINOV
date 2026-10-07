"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatIDR } from "@/lib/utils";
import { Plan, ApiResponse } from "@/lib/types";

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

  const updateMutation = useMutation({
    mutationFn: ({
      planId,
      features,
    }: {
      planId: string;
      features: { feature_key: string; is_enabled: boolean; limit_value: number }[];
    }) =>
      apiClient(`/api/landlord/plans/${planId}/features`, {
        method: "PUT",
        body: JSON.stringify({ features }),
      }),
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

  // Default common SaaS features if none returned yet
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
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            SaaS Plan & Feature Matrix Editor
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Konfigurasi batas kuota limit numerik dan toggle flag fitur di seluruh tier paket
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Catatan Kebijakan:</span> Limit bernilai{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-950 font-mono text-[11px] text-white">
            -1
          </code>{" "}
          merepresentasikan kuota Unlimited (∞). Perubahan pada paket akan langsung terpropagasi ke in-memory policy cache backend.
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-xs">
          Memuat matriks paket & fitur...
        </div>
      ) : isError ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {(error as Error)?.message || "Gagal memuat daftar paket"}
        </div>
      ) : plans.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 text-xs">
          Belum ada paket langganan yang terdaftar.
        </div>
      ) : (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800">
                  <th className="py-4 px-4 font-semibold text-zinc-300 w-64">
                    Fitur & Kuota SaaS
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className="py-4 px-4 font-semibold text-center min-w-[200px]"
                    >
                      <div className="text-zinc-100 font-bold uppercase tracking-wider">
                        {plan.name}
                      </div>
                      <div className="text-[11px] font-mono text-indigo-400 mt-0.5">
                        {formatIDR(plan.price_minor)} / {plan.billing_cycle}
                      </div>
                      <button
                        onClick={() => handleSavePlan(plan.id)}
                        disabled={updateMutation.isPending}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        <span>Simpan Tier</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {featureKeys.map((key) => {
                  const isNumeric = key.startsWith("max_") || key.includes("limit") || key.includes("storage");

                  return (
                    <tr
                      key={key}
                      className="hover:bg-zinc-850/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-medium text-zinc-200">
                          {key}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {isNumeric ? "Batas kuota numerik" : "Fitur saklar (boolean)"}
                        </div>
                      </td>

                      {plans.map((plan) => {
                        const val = getFeatureValue(plan, key);

                        return (
                          <td
                            key={`${plan.id}-${key}`}
                            className="py-3.5 px-4 text-center"
                          >
                            {isNumeric ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  value={val.limit_value}
                                  onChange={(e) =>
                                    handleLimitChange(
                                      plan.id,
                                      key,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-20 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-center text-xs font-mono text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                {val.limit_value === -1 && (
                                  <span className="text-[10px] text-emerald-400 font-mono">
                                    (∞)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggle(plan.id, key, val.is_enabled)
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                                  val.is_enabled
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-zinc-400"
                                }`}
                              >
                                {val.is_enabled ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Aktif</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
}

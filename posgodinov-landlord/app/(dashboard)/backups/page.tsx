"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  RefreshCw,
  Play,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileArchive,
  Layers,
  HardDrive,
  Cloud,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatBytes, cn } from "@/lib/utils";
import { ApiResponse, BackupJob, BackupFile, TriggerBackupPayload } from "@/lib/types";

export default function BackupsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"jobs" | "files">("jobs");
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const [fileScope, setFileScope] = useState<string>("");

  // Form state for triggering backup
  const [targetType, setTargetType] = useState<"ALL" | "LANDLORD" | "TENANT">("ALL");
  const [tenantId, setTenantId] = useState("");
  const [backupMode, setBackupMode] = useState<"FULL" | "TABLES" | "FULL_AND_TABLES">("FULL_AND_TABLES");
  const [storageProvider, setStorageProvider] = useState<"LOCAL" | "GDRIVE" | "BOTH">("BOTH");

  // Query: Backup Jobs
  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isRefetching: isJobsRefetching,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["landlord-backup-jobs"],
    queryFn: () => apiClient<ApiResponse<BackupJob[]>>("/api/landlord/backups/jobs?page=1&limit=30"),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data || [];
      const hasActive = jobs.some(
        (j) => j.status === "PENDING" || j.status === "IN_PROGRESS"
      );
      return hasActive ? 3000 : 15000;
    },
  });

  // Query: Backup Files
  const {
    data: filesData,
    isLoading: isFilesLoading,
    isRefetching: isFilesRefetching,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["landlord-backup-files", fileSearch, fileScope],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (fileSearch) params.set("db_name", fileSearch);
      if (fileScope) params.set("scope", fileScope);
      return apiClient<ApiResponse<BackupFile[]>>(`/api/landlord/backups/files?${params.toString()}`);
    },
  });

  const jobs = jobsData?.data || [];
  const files = filesData?.data || [];

  // Mutation: Trigger Backup
  const triggerMutation = useMutation({
    mutationFn: (payload: TriggerBackupPayload) =>
      apiClient<ApiResponse<BackupJob>>("/api/landlord/backups/trigger", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Pekerjaan backup berhasil dijadwalkan!");
      setIsTriggerModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["landlord-backup-jobs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memicu backup");
    },
  });

  // Mutation: Delete File
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient<ApiResponse<unknown>>(`/api/landlord/backups/files/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Berkas backup berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["landlord-backup-files"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus berkas backup");
    },
  });

  const handleTriggerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === "TENANT" && !tenantId.trim()) {
      toast.error("ID Tenant wajib diisi jika target adalah TENANT");
      return;
    }

    triggerMutation.mutate({
      target: targetType,
      tenant_id: targetType === "TENANT" ? tenantId.trim() : undefined,
      mode: backupMode,
      storage_provider: storageProvider,
    });
  };

  const handleDeleteFile = (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus berkas cadangan "${name}"? Tindakan ini permanen.`)) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: BackupJob["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Selesai
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sedang Berjalan
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Menunggu Antrean
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-300">
            {status}
          </span>
        );
    }
  };

  const getStorageBadge = (provider: string) => {
    switch (provider) {
      case "GDRIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Cloud className="w-3 h-3" />
            Google Drive
          </span>
        );
      case "BOTH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Layers className="w-3 h-3" />
            Dual Storage
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            <HardDrive className="w-3 h-3" />
            Lokal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            Database & Table Backups
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Pencadangan database per-tenant dan landlord, kompresi gzip streaming, dan sinkronisasi Google Drive
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchJobs();
              refetchFiles();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (isJobsRefetching || isFilesRefetching) && "animate-spin")} />
            Perbarui
          </button>

          <button
            onClick={() => setIsTriggerModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Picu Backup Sekarang
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("jobs")}
          className={cn(
            "pb-3 text-xs font-semibold border-b-2 transition flex items-center gap-2",
            activeTab === "jobs"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Clock className="w-4 h-4" />
          Riwayat Pekerjaan Backup ({jobs.length})
        </button>

        <button
          onClick={() => setActiveTab("files")}
          className={cn(
            "pb-3 text-xs font-semibold border-b-2 transition flex items-center gap-2",
            activeTab === "files"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <FileArchive className="w-4 h-4" />
          Daftar Berkas Backup ({files.length})
        </button>
      </div>

      {/* TAB 1: BACKUP JOBS */}
      {activeTab === "jobs" && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Job ID</th>
                  <th className="py-3 px-4 font-semibold">Target & Mode</th>
                  <th className="py-3 px-4 font-semibold">Penyimpanan</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Progress DB</th>
                  <th className="py-3 px-4 font-semibold">Total Ukuran</th>
                  <th className="py-3 px-4 font-semibold">Waktu Mulai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isJobsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      Memuat riwayat backup...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      Belum ada pekerjaan backup yang tercatat. Klik &quot;Picu Backup Sekarang&quot; untuk memulai.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-800/20 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                        {job.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-200">
                          {job.target_type === "TENANT"
                            ? `Tenant: ${job.target_id}`
                            : job.target_type === "LANDLORD"
                            ? "Database Landlord"
                            : "Semua Database (All)"}
                        </div>
                        <div className="text-[10px] text-zinc-400 uppercase mt-0.5">
                          Mode: {job.mode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStorageBadge(job.storage_provider)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(job.status)}
                        {job.error_message && (
                          <p className="text-[10px] text-rose-400 max-w-xs truncate mt-1" title={job.error_message}>
                            {job.error_message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-mono">
                        {job.completed_dbs} / {job.total_dbs || "-"} DB
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-mono">
                        {formatBytes(job.total_size_bytes)}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {formatDate(job.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP FILES */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Cari nama database (mis. business_ atau posgodinov)..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <select
              value={fileScope}
              onChange={(e) => setFileScope(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">Semua Scope (Full & Tables)</option>
              <option value="FULL">Hanya Full Dump</option>
              <option value="TABLE">Hanya Table Dump</option>
            </select>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Database</th>
                    <th className="py-3 px-4 font-semibold">Scope</th>
                    <th className="py-3 px-4 font-semibold">Nama / Path Berkas</th>
                    <th className="py-3 px-4 font-semibold">Ukuran</th>
                    <th className="py-3 px-4 font-semibold">Waktu Pembuatan</th>
                    <th className="py-3 px-4 font-semibold">Penyimpanan</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isFilesLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        Memuat daftar berkas backup...
                      </td>
                    </tr>
                  ) : files.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        Tidak ada berkas backup yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    files.map((file) => (
                      <tr key={file.id} className="hover:bg-zinc-800/20 transition">
                        <td className="py-3 px-4 font-mono font-medium text-zinc-200">
                          {file.db_name}
                        </td>
                        <td className="py-3 px-4">
                          {file.scope === "FULL" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              FULL DB
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              TABLE: {file.table_name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono text-[11px] max-w-xs truncate" title={file.file_path}>
                          {file.file_path}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-300">
                          {formatBytes(file.file_size_bytes)}
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {formatDate(file.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStorageBadge(file.storage_provider)}
                            {file.remote_web_link && (
                              <a
                                href={file.remote_web_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 transition"
                                title="Buka di Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/api/landlord/backups/files/${file.id}/download`}
                              download
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              title="Unduh Berkas (.sql.gz)"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => handleDeleteFile(file.id, file.file_path)}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                              title="Hapus Berkas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TRIGGER MODAL DIALOG */}
      {isTriggerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                Picu Pekerjaan Backup Baru
              </h2>
              <button
                onClick={() => setIsTriggerModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTriggerSubmit} className="p-6 space-y-4">
              {/* Target Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Target Database
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "ALL", label: "Semua (All)" },
                    { id: "LANDLORD", label: "Landlord DB" },
                    { id: "TENANT", label: "Tenant Spesifik" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetType(t.id as any)}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-medium border text-center transition",
                        targetType === t.id
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenant ID Input if Target is TENANT */}
              {targetType === "TENANT" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Tenant ID (Business ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="mis. 8x9k2m1q"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Sistem akan mem-backup database physical <code>business_{tenantId.toLowerCase()}</code>
                  </p>
                </div>
              )}

              {/* Mode */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Lingkup Pencadangan (Mode)
                </label>
                <select
                  value={backupMode}
                  onChange={(e) => setBackupMode(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="FULL_AND_TABLES">Lengkap (Full Database + Dump per-Tabel)</option>
                  <option value="FULL">Hanya Full Database (.sql.gz tunggal)</option>
                  <option value="TABLES">Hanya Per-Tabel (Dump masing-masing tabel terpisah)</option>
                </select>
              </div>

              {/* Storage Provider */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Lokasi Penyimpanan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "BOTH", label: "Dual (Lokal & GDrive)" },
                    { id: "LOCAL", label: "Hanya Lokal" },
                    { id: "GDRIVE", label: "Hanya Google Drive" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStorageProvider(s.id as any)}
                      className={cn(
                        "py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition",
                        storageProvider === s.id
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTriggerModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={triggerMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {triggerMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {triggerMutation.isPending ? "Menjadwalkan..." : "Mulai Backup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

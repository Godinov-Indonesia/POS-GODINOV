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
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          <Badge tone="success" icon={CheckCircle2}>
            Selesai
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge tone="info" icon={RefreshCw}>
            Berjalan
          </Badge>
        );
      case "PENDING":
        return (
          <Badge tone="warning" icon={Clock}>
            Antrean
          </Badge>
        );
      case "FAILED":
        return (
          <Badge tone="danger" icon={AlertCircle}>
            Gagal
          </Badge>
        );
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  const getStorageBadge = (provider: string) => {
    switch (provider) {
      case "GDRIVE":
        return (
          <Badge tone="info" icon={Cloud}>
            Google Drive
          </Badge>
        );
      case "BOTH":
        return (
          <Badge tone="info" icon={Layers}>
            Dual Storage
          </Badge>
        );
      default:
        return (
          <Badge tone="neutral" icon={HardDrive}>
            Lokal
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg flex items-center gap-2">
            <Database className="size-5 text-accent" />
            Database & Table Backups
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Pencadangan database per-tenant dan landlord, kompresi gzip streaming, dan sinkronisasi Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="neutral"
            size="sm"
            onClick={() => {
              refetchJobs();
              refetchFiles();
            }}
          >
            <RefreshCw className={cn("size-3.5", (isJobsRefetching || isFilesRefetching) && "animate-spin")} />
            <span>Perbarui</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsTriggerModalOpen(true)}
          >
            <Play className="size-3.5 fill-current" />
            <span>Picu Backup Sekarang</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("jobs")}
          className={cn(
            "pb-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer",
            activeTab === "jobs"
              ? "border-accent text-accent"
              : "border-transparent text-fg-muted hover:text-fg"
          )}
        >
          <Clock className="size-4" />
          <span>Riwayat Pekerjaan Backup ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("files")}
          className={cn(
            "pb-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer",
            activeTab === "files"
              ? "border-accent text-accent"
              : "border-transparent text-fg-muted hover:text-fg"
          )}
        >
          <FileArchive className="size-4" />
          <span>Daftar Berkas Backup ({files.length})</span>
        </button>
      </div>

      {/* TAB 1: BACKUP JOBS */}
      {activeTab === "jobs" && (
        <Table>
          <THead>
            <tr>
              <TH>Job ID</TH>
              <TH>Target & Mode</TH>
              <TH>Penyimpanan</TH>
              <TH>Status</TH>
              <TH>Progress DB</TH>
              <TH>Total Ukuran</TH>
              <TH>Waktu Mulai</TH>
            </tr>
          </THead>
          <TBody>
            {isJobsLoading ? (
              <tr>
                <TD colSpan={7} className="py-8 text-center text-fg-subtle">
                  Memuat riwayat backup...
                </TD>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <TD colSpan={7} className="py-12 text-center text-fg-subtle">
                  Belum ada pekerjaan backup yang tercatat. Klik &quot;Picu Backup Sekarang&quot; untuk memulai.
                </TD>
              </tr>
            ) : (
              jobs.map((job) => (
                <TR key={job.id}>
                  <TD className="font-mono text-[11px] text-fg-subtle">
                    {job.id.slice(0, 8)}...
                  </TD>
                  <TD>
                    <div className="font-semibold text-fg">
                      {job.target_type === "TENANT"
                        ? `Tenant: ${job.target_id}`
                        : job.target_type === "LANDLORD"
                        ? "Database Landlord"
                        : "Semua Database (All)"}
                    </div>
                    <div className="text-[10px] text-fg-subtle uppercase mt-0.5 font-mono">
                      Mode: {job.mode}
                    </div>
                  </TD>
                  <TD>{getStorageBadge(job.storage_provider)}</TD>
                  <TD>
                    {getStatusBadge(job.status)}
                    {job.error_message && (
                      <p className="text-[10px] text-danger max-w-xs truncate mt-1" title={job.error_message}>
                        {job.error_message}
                      </p>
                    )}
                  </TD>
                  <TD className="font-mono">
                    {job.completed_dbs} / {job.total_dbs || "-"} DB
                  </TD>
                  <TD className="font-mono">
                    {formatBytes(job.total_size_bytes)}
                  </TD>
                  <TD className="text-fg-muted font-mono text-[11px]">
                    {formatDate(job.created_at)}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      {/* TAB 2: BACKUP FILES */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <Input
                type="text"
                placeholder="Cari nama database (mis. business_ atau posgodinov)..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={fileScope}
              onChange={(e) => setFileScope(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
            >
              <option value="">Semua Scope (Full & Tables)</option>
              <option value="FULL">Hanya Full Dump</option>
              <option value="TABLE">Hanya Table Dump</option>
            </select>
          </div>

          <Table>
            <THead>
              <tr>
                <TH>Database</TH>
                <TH>Scope</TH>
                <TH>Nama / Path Berkas</TH>
                <TH>Ukuran</TH>
                <TH>Waktu Pembuatan</TH>
                <TH>Penyimpanan</TH>
                <TH numeric>Aksi</TH>
              </tr>
            </THead>
            <TBody>
              {isFilesLoading ? (
                <tr>
                  <TD colSpan={7} className="py-8 text-center text-fg-subtle">
                    Memuat daftar berkas backup...
                  </TD>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <TD colSpan={7} className="py-12 text-center text-fg-subtle">
                    Tidak ada berkas backup yang ditemukan.
                  </TD>
                </tr>
              ) : (
                files.map((file) => (
                  <TR key={file.id}>
                    <TD className="font-mono font-medium text-fg">
                      {file.db_name}
                    </TD>
                    <TD>
                      {file.scope === "FULL" ? (
                        <Badge tone="success">FULL DB</Badge>
                      ) : (
                        <Badge tone="info">TABLE: {file.table_name}</Badge>
                      )}
                    </TD>
                    <TD className="text-fg-muted font-mono text-[11px] max-w-xs truncate" title={file.file_path}>
                      {file.file_path}
                    </TD>
                    <TD className="font-mono">
                      {formatBytes(file.file_size_bytes)}
                    </TD>
                    <TD className="text-fg-muted font-mono text-[11px]">
                      {formatDate(file.created_at)}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        {getStorageBadge(file.storage_provider)}
                        {file.remote_web_link && (
                          <a
                            href={file.remote_web_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:text-accent-hover transition"
                            title="Buka di Google Drive"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </TD>
                    <TD numeric>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/landlord/backups/files/${file.id}/download`}
                          download
                          className="p-1.5 rounded-lg border border-border bg-surface hover:bg-bg-muted text-fg transition"
                          title="Unduh Berkas (.sql.gz)"
                        >
                          <Download className="size-3.5" />
                        </a>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id, file.file_path)}
                          disabled={deleteMutation.isPending}
                          className="text-danger hover:bg-danger-subtle/50 p-1.5 h-auto"
                          title="Hapus Berkas"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      )}

      {/* TRIGGER MODAL DIALOG */}
      {isTriggerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                <Database className="size-4 text-accent" />
                <span>Picu Pekerjaan Backup Baru</span>
              </h2>
              <button
                onClick={() => setIsTriggerModalOpen(false)}
                className="text-fg-subtle hover:text-fg transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleTriggerSubmit} className="p-6 space-y-4 text-xs">
              {/* Target Type */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
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
                        "py-2 px-3 rounded-lg text-xs font-medium border text-center transition cursor-pointer",
                        targetType === t.id
                          ? "bg-accent-subtle border-accent text-accent font-semibold"
                          : "bg-surface border-border text-fg-muted hover:text-fg hover:bg-bg-muted"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenant ID input */}
              {targetType === "TENANT" && (
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1.5">
                    Tenant Business ID (UUID)
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Contoh: c1234567-89ab-cdef-0123-456789abcdef"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-[10px] text-fg-subtle mt-1">
                    Database target: <code className="font-mono text-accent">business_&#123;id&#125;</code>
                  </p>
                </div>
              )}

              {/* Backup Mode */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
                  Mode Pencadangan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "FULL_AND_TABLES", label: "Full + Per Table", desc: "Direkomendasikan" },
                    { id: "FULL", label: "Hanya Full Dump", desc: "1 berkas .sql.gz" },
                    { id: "TABLES", label: "Hanya Per Table", desc: "Tiap tabel terpisah" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setBackupMode(m.id as any)}
                      className={cn(
                        "p-2.5 rounded-lg text-left border transition cursor-pointer",
                        backupMode === m.id
                          ? "bg-accent-subtle border-accent"
                          : "bg-surface border-border hover:bg-bg-muted"
                      )}
                    >
                      <div className={cn("text-xs font-semibold", backupMode === m.id ? "text-accent" : "text-fg")}>
                        {m.label}
                      </div>
                      <div className="text-[10px] text-fg-subtle mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Provider */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
                  Tujuan Penyimpanan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "BOTH", label: "Lokal + Google Drive", icon: Layers },
                    { id: "GDRIVE", label: "Google Drive Cloud", icon: Cloud },
                    { id: "LOCAL", label: "Penyimpanan Lokal", icon: HardDrive },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setStorageProvider(p.id as any)}
                        className={cn(
                          "py-2.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer",
                          storageProvider === p.id
                            ? "bg-accent-subtle border-accent text-accent font-semibold"
                            : "bg-surface border-border text-fg-muted hover:text-fg hover:bg-bg-muted"
                        )}
                      >
                        <Icon className="size-3.5" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="neutral"
                  size="sm"
                  onClick={() => setIsTriggerModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={triggerMutation.isPending}
                >
                  {triggerMutation.isPending ? "Menjadwalkan..." : "Mulai Backup Sekarang"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

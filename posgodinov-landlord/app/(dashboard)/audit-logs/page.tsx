"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Clock, ChevronLeft, ChevronRight, Laptop } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { ApiResponse, LandlordAuditLog } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["landlord-audit-logs", page],
    queryFn: () =>
      apiClient<ApiResponse<LandlordAuditLog[]>>(
        `/api/landlord/audit-logs?page=${page}&limit=${limit}`
      ),
  });

  const rawLogs = data?.data;
  const rawLogsObj = rawLogs as Record<string, unknown> | undefined;
  const logs: LandlordAuditLog[] = Array.isArray(rawLogs)
    ? rawLogs
    : Array.isArray(rawLogsObj?.logs)
    ? (rawLogsObj.logs as LandlordAuditLog[])
    : [];
  const meta = data?.meta || {};
  const total =
    meta.total ??
    (rawLogsObj?.total as number | undefined) ??
    logs.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const getActionTone = (action: string): "neutral" | "info" | "success" | "warning" | "danger" => {
    const act = action.toUpperCase();
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("REMOVE")) return "danger";
    if (act.includes("CREATE") || act.includes("ADD") || act.includes("TRIGGER")) return "success";
    if (act.includes("UPDATE") || act.includes("EDIT") || act.includes("SET")) return "info";
    return "neutral";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            Audit Trail &amp; Log Superadmin
          </h1>
          <p className="text-xs text-muted-fg mt-1">
            Riwayat seluruh tindakan administratif untuk kepatuhan dan audit keamanan
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Tindakan</TH>
              <TH>Target (Type &amp; ID)</TH>
              <TH>Metadata</TH>
              <TH>Waktu &amp; IP</TH>
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              <TR>
                <TD colSpan={4} className="py-8 text-center text-muted-fg">
                  <Skeleton className="h-6 w-1/2 mx-auto" />
                </TD>
              </TR>
            ) : isError ? (
              <TR>
                <TD colSpan={4} className="py-8 text-center text-danger-text">
                  {(error as Error)?.message || "Gagal memuat log audit"}
                </TD>
              </TR>
            ) : logs.length === 0 ? (
              <TR>
                <TD colSpan={4} className="py-8">
                  <EmptyState
                    icon={ScrollText}
                    title="Tidak ada log audit"
                    description="Belum ada riwayat aktivitas administratif yang tercatat."
                  />
                </TD>
              </TR>
            ) : (
              logs.map((log) => (
                <TR key={log.id}>
                  <TD>
                    <Badge tone={getActionTone(log.action)}>
                      {log.action}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="font-medium text-fg">{log.target_type}</div>
                    <div className="text-[11px] font-mono text-muted-fg mt-0.5 truncate max-w-[200px]" title={log.target_id}>
                      {log.target_id}
                    </div>
                  </TD>
                  <TD>
                    <div
                      className="text-[11px] font-mono text-muted-fg max-w-sm truncate bg-muted/60 px-2 py-1 rounded"
                      title={JSON.stringify(log.metadata)}
                    >
                      {JSON.stringify(log.metadata || {})}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5 text-xs text-fg">
                      <Clock className="w-3.5 h-3.5 text-muted-fg" />
                      <span>{formatDate(log.created_at)}</span>
                    </div>
                    {log.ip_address && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-muted-fg mt-1">
                        <Laptop className="w-3 h-3" />
                        <span>{log.ip_address}</span>
                      </div>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-fg">
          <div>
            Total <span className="font-mono font-semibold text-fg">{total}</span> rekaman log
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px]">
              Hal {page} dari {totalPages}
            </span>
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              variant="neutral"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              variant="neutral"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

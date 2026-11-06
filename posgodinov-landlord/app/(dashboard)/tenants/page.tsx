"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { BusinessWithSubscription, ApiResponse } from "@/lib/types";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function getStatusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return (
        <Badge tone="success" icon={CheckCircle2}>
          Active
        </Badge>
      );
    case "SUSPENDED":
      return (
        <Badge tone="danger" icon={XCircle}>
          Suspended
        </Badge>
      );
    case "PAST_DUE":
      return (
        <Badge tone="warning" icon={AlertTriangle}>
          Past Due
        </Badge>
      );
    case "TRIAL":
      return (
        <Badge tone="info" icon={Clock}>
          Trial
        </Badge>
      );
    default:
      return <Badge tone="neutral">{status || "UNKNOWN"}</Badge>;
  }
}

export default function TenantsDirectoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 15;

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (search.trim()) queryParams.set("search", search.trim());
  if (statusFilter) queryParams.set("status", statusFilter);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["landlord-tenants", page, search, statusFilter],
    queryFn: () =>
      apiClient<ApiResponse<BusinessWithSubscription[]>>(
        `/api/landlord/businesses?${queryParams.toString()}`
      ),
  });

  const rawData = data?.data;
  const businesses: BusinessWithSubscription[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.businesses)
    ? (rawData as any).businesses
    : Array.isArray((data as any)?.businesses)
    ? (data as any).businesses
    : [];

  const meta = data?.meta || {};
  const total =
    meta.total ??
    (rawData as any)?.total ??
    (data as any)?.total ??
    businesses.length;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-fg">
          Tenant 360 Directory
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Manajemen direktori seluruh tenant, kepemilikan, paket aktif, dan status operasional.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="size-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Cari nama bisnis, serial, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Filter className="size-3.5 text-fg-subtle" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-surface px-3 py-1 text-xs text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="TRIAL">TRIAL</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Table>
        <THead>
          <tr>
            <TH>Bisnis / Serial</TH>
            <TH>Owner & Email</TH>
            <TH>Paket SaaS</TH>
            <TH>Status Operasi</TH>
            <TH>Tgl Terdaftar</TH>
            <TH numeric>Aksi</TH>
          </tr>
        </THead>
        <TBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <TR key={idx}>
                <TD colSpan={6}>
                  <div className="h-5 bg-bg-muted animate-pulse rounded" />
                </TD>
              </TR>
            ))
          ) : isError ? (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-danger">
                {(error as Error)?.message || "Gagal memuat direktori tenant"}
              </TD>
            </TR>
          ) : businesses.length === 0 ? (
            <TR>
              <TD colSpan={6} className="py-12 text-center text-fg-subtle">
                <Building2 className="size-8 mx-auto mb-2 text-fg-subtle/50" />
                <div>Tidak ada tenant yang sesuai dengan kriteria pencarian.</div>
              </TD>
            </TR>
          ) : (
            businesses.map((b) => (
              <TR key={b.id}>
                <TD>
                  <div className="font-semibold text-fg">{b.name}</div>
                  <div className="font-mono text-[11px] text-fg-subtle">
                    {b.serial_business}
                  </div>
                </TD>
                <TD>
                  <div className="text-fg">{b.owner_name}</div>
                  <div className="text-[11px] text-fg-subtle">{b.email}</div>
                </TD>
                <TD>
                  <Badge tone="info">
                    {b.plan_code || "FREE"}
                  </Badge>
                </TD>
                <TD>{getStatusBadge(b.subscription_status)}</TD>
                <TD className="text-fg-muted font-mono text-[11px]">
                  {formatDate(b.created_at)}
                </TD>
                <TD numeric>
                  <Link href={`/tenants/${b.id}`}>
                    <Button variant="neutral" size="sm">
                      <Eye className="size-3.5" />
                      <span>Detail 360</span>
                    </Button>
                  </Link>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {/* Pagination Footer */}
      <div className="px-2 flex items-center justify-between text-xs text-fg-muted">
        <div>
          Total <span className="font-mono font-semibold text-fg">{total}</span> tenant terdaftar
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px]">
            Hal {page} dari {totalPages}
          </span>
          <Button
            variant="neutral"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="neutral"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client'

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Lock,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Money, formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import {
  useApproveSOForm,
  useCloseSOForm,
  usePublishSOForm,
  useRecountSOForm,
  useRejectSOForm,
  useSOFormDetail,
} from '@/features/admin/inventory/hooks/useSOForms'
import { SOStatusBadge } from '@/features/admin/so/components/SOStatusBadge'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { toMinor } from '@/lib/money'
import { formatDateTimeId } from '@/lib/time'
import type {
  SOClosedResponse,
  SOFinalSheetItem,
  SOFormResponse,
} from '@/lib/types/inventory'
import { cn } from '@/lib/utils/cn'

export function SOFormDetail({ formId }: { formId: string }) {
  return (
    <OutletGuard>
      {(outletId) => <SOFormDetailInner outletId={outletId} formId={formId} />}
    </OutletGuard>
  )
}

function isClosedResponse(
  data: SOFormResponse | SOClosedResponse | undefined,
): data is SOClosedResponse {
  return !!data && 'final_sheet' in data
}

function SOFormDetailInner({
  outletId,
  formId,
}: {
  outletId: string
  formId: string
}) {
  const router = useRouter()
  const { data, isPending, error } = useSOFormDetail(outletId, formId)

  const publishMutation = usePublishSOForm(outletId)
  const closeMutation = useCloseSOForm(outletId)
  const approveMutation = useApproveSOForm(outletId)
  const rejectMutation = useRejectSOForm(outletId)
  const recountMutation = useRecountSOForm(outletId)

  // Dialog states
  const [confirmPublish, setConfirmPublish] = React.useState(false)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const [confirmApprove, setConfirmApprove] = React.useState(false)
  const [confirmReject, setConfirmReject] = React.useState(false)
  const [confirmRecount, setConfirmRecount] = React.useState(false)

  // Active Tab for Closed review
  const [reviewTab, setReviewTab] = React.useState<'FINAL' | 'STAFF' | 'HISTORY'>('FINAL')

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat detail form SO')
  }, [error])

  if (isPending) return <Skeleton className="h-96 w-full max-w-5xl" />
  if (!data) return <Banner tone="danger">Form SO tidak ditemukan.</Banner>

  const isClosed = isClosedResponse(data)
  const openForm = !isClosed ? data : null
  const closedData = isClosed ? data : null
  const status = data.status

  const finalItems = closedData?.final_sheet?.items ?? []
  const totalItems =
    closedData?.final_sheet?.summary?.total_items ??
    closedData?.final_sheet?.summary?.items_counted ??
    finalItems.length
  const differentItems =
    closedData?.final_sheet?.summary?.different_items ??
    closedData?.final_sheet?.summary?.items_with_variance ??
    finalItems.filter((it) => Math.abs(it.difference) > 0.0001).length
  const matchedItems =
    closedData?.final_sheet?.summary?.matched_items ??
    Math.max(0, totalItems - differentItems)
  const fraudFlaggedItems =
    closedData?.final_sheet?.summary?.fraud_flagged_items ??
    finalItems.filter((it) => it.fraud_flag).length
  const totalDifferenceValue =
    closedData?.final_sheet?.summary?.total_difference_value ??
    closedData?.final_sheet?.summary?.total_variance_value ??
    finalItems.reduce((acc, it) => acc + (it.difference_value ?? 0), 0)

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync(formId)
      toast.success('Form SO berhasil dipublish')
      setConfirmPublish(false)
    } catch (err) {
      toastApiError(err, 'Gagal mempublish form SO')
    }
  }

  const handleClose = async () => {
    try {
      await closeMutation.mutateAsync(formId)
      toast.success('Form SO ditutup, snapshot stok sistem berhasil diambil')
      setConfirmClose(false)
    } catch (err) {
      toastApiError(err, 'Gagal menutup form SO')
    }
  }

  const handleApprove = async () => {
    try {
      const res = await approveMutation.mutateAsync(formId)
      toast.success(`Form SO disetujui! Stok ${res.items_adjusted} bahan baku telah disesuaikan`)
      setConfirmApprove(false)
    } catch (err) {
      toastApiError(err, 'Gagal menyetujui form SO')
    }
  }

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync(formId)
      toast.success('Form SO ditolak tanpa mengubah stok')
      setConfirmReject(false)
    } catch (err) {
      toastApiError(err, 'Gagal menolak form SO')
    }
  }

  const handleRecount = async () => {
    try {
      const newForm = await recountMutation.mutateAsync(formId)
      toast.success(`Form recount baru (Recount #${newForm.recount_number}) berhasil dibuat`)
      setConfirmRecount(false)
      router.push(`/admin/inventory/opname/${newForm.id}`)
    } catch (err) {
      toastApiError(err, 'Gagal membuat form recount')
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inventory/opname"
            className={buttonVariants({ variant: 'neutral', size: 'sm' })}
          >
            <ArrowLeft className="size-4 mr-1" aria-hidden="true" />
            Kembali
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-pos-lg font-bold text-fg">Form SO: {data.id.slice(0, 8)}…</h2>
              <SOStatusBadge status={status} />
              {data.recount_number > 0 ? (
                <span className="rounded bg-brand-subtle px-2 py-0.5 text-pos-xs font-semibold text-brand">
                  Recount #{data.recount_number}
                </span>
              ) : null}
            </div>
            <p className="text-pos-xs text-fg-muted mt-0.5">
              Cakupan: <strong>{data.scope}</strong> • Dibuat: {formatDateTimeId(data.created_at)}
              {data.notes ? ` • ${data.notes}` : ''}
            </p>
          </div>
        </div>

        {/* Action Top Bar */}
        <div className="flex items-center gap-2">
          {status === 'OPEN' ? (
            <Button
              variant="primary"
              onClick={() => setConfirmPublish(true)}
              disabled={publishMutation.isPending}
            >
              <Send className="size-4 mr-1.5" aria-hidden="true" />
              Publish Form ke Mobile
            </Button>
          ) : status === 'PUBLISHED' || status === 'COUNTING' ? (
            <Button
              variant="primary"
              onClick={() => setConfirmClose(true)}
              disabled={closeMutation.isPending}
            >
              <Lock className="size-4 mr-1.5" aria-hidden="true" />
              Tutup Form (Close & Rekonsiliasi)
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── FASE 1: STATUS OPEN (DRAFT) ─────────────────────────────────── */}
      {status === 'OPEN' && openForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Bahan Baku yang Akan Diaudit ({openForm.materials?.length ?? 0} Bahan)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Banner tone="info" icon={Clock}>
              Form ini berstatus <strong>DRAFT (OPEN)</strong>. Bahan baku belum terlihat di aplikasi kasir.
              Klik <strong>Publish Form</strong> bila sudah siap diaudit oleh staf.
            </Banner>
            <MaterialListTable materials={openForm.materials ?? []} />
          </CardContent>
        </Card>
      ) : null}

      {/* ── FASE 2: STATUS PUBLISHED / COUNTING ──────────────────────────── */}
      {(status === 'PUBLISHED' || status === 'COUNTING') && openForm ? (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Progres Penghitungan Lapangan (SO Mobile)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Banner tone="info" icon={Play}>
                Form sedang aktif di aplikasi kasir/gudang. Staf menginput hitungan secara{' '}
                <strong>blind opname</strong> (tanpa melihat stok sistem).
              </Banner>

              <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-subtle p-4">
                <div className="flex items-center justify-between text-pos-sm font-semibold">
                  <span>Progres Bahan Terhitung</span>
                  <span>
                    {openForm.count_progress?.counted_materials ?? 0} dari{' '}
                    {openForm.count_progress?.total_materials ?? openForm.materials?.length ?? 0} bahan
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-accent transition-all duration-500"
                    style={{
                      width: `${
                        (openForm.count_progress?.total_materials ?? 0) > 0
                          ? ((openForm.count_progress?.counted_materials ?? 0) /
                              (openForm.count_progress?.total_materials ?? 1)) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1 text-pos-xs text-fg-muted">
                  <Users className="size-3.5 text-accent" aria-hidden="true" />
                  <span>
                    Staf yang telah berpartisipasi:{' '}
                    <strong>
                      {openForm.count_progress?.counters?.length
                        ? `${openForm.count_progress.counters.length} staf`
                        : 'Belum ada'}
                    </strong>
                  </span>
                </div>
              </div>

              <h4 className="font-semibold text-fg pt-2">Daftar Bahan yang Diaudit:</h4>
              <MaterialListTable materials={openForm.materials ?? []} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── FASE 3: STATUS CLOSED / APPROVED / REJECTED ──────────────────── */}
      {closedData ? (
        <div className="flex flex-col gap-6">
          {/* Executive KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Bahan Diaudit"
              value={`${totalItems} bahan`}
              subtitle={`${matchedItems} bahan sesuai`}
            />
            <KPICard
              title="Bahan Berselisih"
              value={`${differentItems} bahan`}
              subtitle="Terdapat deviasi fisik"
              tone={differentItems > 0 ? 'warning' : 'neutral'}
            />
            <KPICard
              title="Flag Fraud / Selisih Kritis"
              value={`${fraudFlaggedItems} bahan`}
              subtitle="Selisih > 10% atau > Rp 50.000"
              tone={fraudFlaggedItems > 0 ? 'danger' : 'neutral'}
              icon={fraudFlaggedItems > 0 ? ShieldAlert : undefined}
            />
            <KPICard
              title="Total Nilai Selisih"
              value={
                <Money
                  minor={toMinor(totalDifferenceValue)}
                  size="md"
                  signed
                  tone={totalDifferenceValue < 0 ? 'danger' : 'success'}
                />
              }
              subtitle="Dihitung dari selisih × HPP"
            />
          </div>

          {/* Banner Status Persetujuan */}
          {status === 'CLOSED' ? (
            <Banner tone="warning" icon={AlertTriangle} title="Form telah ditutup — Menunggu Keputusan Owner">
              Seluruh hitungan fisik staf telah diagregasi dan dikunci. Periksa lembar final di bawah
              ini. Jika sudah benar, klik <strong>Setujui & Sesuaikan Stok</strong>. Jika selisih
              mencurigakan, Anda dapat membuka <strong>Hitung Ulang (Recount)</strong>.
            </Banner>
          ) : status === 'APPROVED' ? (
            <Banner tone="info" icon={CheckCircle2} title="Form Telah Disetujui (Approved)">
              Stok fisik telah berhasil diperbarui ke database raw materials. Form ini tersimpan sebagai
              arsip audit historis.
            </Banner>
          ) : status === 'REJECTED' ? (
            <Banner tone="danger" icon={XCircle} title="Form Ditolak (Rejected)">
              Form ini ditolak oleh Owner. Angka stok sistem tidak mengalami perubahan apa pun.
            </Banner>
          ) : null}

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-border pb-1">
            <button
              type="button"
              onClick={() => setReviewTab('FINAL')}
              className={cn(
                'rounded-md px-3.5 py-2 text-pos-sm font-semibold transition-colors',
                reviewTab === 'FINAL'
                  ? 'bg-brand text-fg-inverse shadow-sm'
                  : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
              )}
            >
              Lembar Final Gabungan ({closedData.final_sheet.items.length})
            </button>
            <button
              type="button"
              onClick={() => setReviewTab('STAFF')}
              className={cn(
                'rounded-md px-3.5 py-2 text-pos-sm font-semibold transition-colors',
                reviewTab === 'STAFF'
                  ? 'bg-brand text-fg-inverse shadow-sm'
                  : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
              )}
            >
              Lembar Hitungan Staf ({closedData.count_sheets.length} Kasir)
            </button>
            {closedData.history?.length ? (
              <button
                type="button"
                onClick={() => setReviewTab('HISTORY')}
                className={cn(
                  'rounded-md px-3.5 py-2 text-pos-sm font-semibold transition-colors',
                  reviewTab === 'HISTORY'
                    ? 'bg-brand text-fg-inverse shadow-sm'
                    : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
                )}
              >
                Riwayat Recount ({closedData.history.length})
              </button>
            ) : null}
          </div>

          {/* Tab Content: Final Sheet */}
          {reviewTab === 'FINAL' ? (
            <Card>
              <CardContent className="pt-4 overflow-x-auto">
                <FinalSheetTable items={closedData.final_sheet.items} />
              </CardContent>
            </Card>
          ) : null}

          {/* Tab Content: Staff Count Sheets */}
          {reviewTab === 'STAFF' ? (
            <div className="flex flex-col gap-4">
              {!closedData.count_sheets.length ? (
                <EmptyState icon={Users} title="Belum ada lembar hitungan staf" />
              ) : (
                closedData.count_sheets.map((sheet) => (
                  <Card key={sheet.counted_by}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-pos-sm flex items-center justify-between">
                        <span>Penghitung: <strong>{sheet.staff_name || sheet.counted_by}</strong></span>
                        <span className="text-pos-xs text-fg-muted font-normal">
                          {sheet.items.length} bahan dihitung
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Bahan Baku</TH>
                            <TH numeric>Kemasan Utuh</TH>
                            <TH numeric>Eceran Terbuka</TH>
                            <TH numeric>Total Unit Fisik</TH>
                            <TH>Catatan Staf</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {sheet.items.map((item) => (
                            <TR key={item.raw_material_id}>
                              <TD className="font-medium">{item.raw_material_name}</TD>
                              <TD numeric>
                                <strong className="text-fg">{item.actual_packages}</strong> kemasan
                              </TD>
                              <TD numeric>
                                {formatQuantity(item.actual_loose)} {item.unit}
                              </TD>
                              <TD numeric className="font-semibold text-fg">
                                {formatQuantity(item.actual_stock)} {item.unit}
                              </TD>
                              <TD className="text-fg-muted">{item.notes || '—'}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : null}

          {/* Tab Content: Recount History */}
          {reviewTab === 'HISTORY' && closedData.history?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-pos-sm flex items-center gap-2">
                  <History className="size-4 text-brand" />
                  Rantai Audit Hitung Ulang (Recount Chain)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>Sesi</TH>
                      <TH>Status</TH>
                      <TH>Waktu Dibuat</TH>
                      <TH>Waktu Selesai</TH>
                      <TH>Tautan</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {closedData.history.map((h) => (
                      <TR key={h.id}>
                        <TD className="font-semibold text-fg">{h.label}</TD>
                        <TD>
                          <SOStatusBadge status={h.status} />
                        </TD>
                        <TD className="text-fg-muted">{formatDateTimeId(h.created_at)}</TD>
                        <TD className="text-fg-muted">
                          {h.closed_at ? formatDateTimeId(h.closed_at) : '—'}
                        </TD>
                        <TD>
                          {h.id === formId ? (
                            <span className="text-pos-xs font-semibold text-fg-muted">
                              (Sedang Dilihat)
                            </span>
                          ) : (
                            <Link
                              href={`/admin/inventory/opname/${h.id}`}
                              className="text-accent underline hover:text-accent-hover font-medium text-pos-sm"
                            >
                              Buka Form
                            </Link>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {/* Action Bar (Hanya jika CLOSED) */}
          {status === 'CLOSED' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <Button
                variant="neutral"
                onClick={() => setConfirmRecount(true)}
                disabled={recountMutation.isPending}
              >
                <RotateCcw className="size-4 mr-1.5 text-warning-text" aria-hidden="true" />
                Buka Hitung Ulang (Recount)
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  variant="neutral"
                  onClick={() => setConfirmReject(true)}
                  disabled={rejectMutation.isPending}
                  className="text-danger hover:bg-danger-subtle"
                >
                  <XCircle className="size-4 mr-1.5" aria-hidden="true" />
                  Tolak Form (Reject)
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setConfirmApprove(true)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="size-4 mr-1.5" aria-hidden="true" />
                  Setujui & Terapkan Stok
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── MODAL KONFIRMASI ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={handlePublish}
        pending={publishMutation.isPending}
        title="Terbitkan Form Stock Opname?"
        description="Setelah dipublish, form ini akan muncul di aplikasi SO Mobile kasir dan staf dapat mulai menginput hitungan fisik."
        confirmLabel="Ya, Terbitkan"
      />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleClose}
        pending={closeMutation.isPending}
        title="Tutup Form SO dan Hitung Selisih?"
        description="Menutup form akan mengunci input staf lapangan, mengagregasi hitungan fisik, dan mengambil snapshot stok sistem saat ini untuk mengkalkulasi selisih stok & fraud flag."
        confirmLabel="Ya, Tutup & Hitung"
      />

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={handleApprove}
        pending={approveMutation.isPending}
        title="Setujui dan Perbarui Stok Bahan Baku?"
        description="Persetujuan ini akan LANGSUNG menimpa package_stock dan loose_stock pada database dengan hasil hitung fisik. Tindakan ini permanen."
        confirmLabel="Ya, Setujui & Terapkan"
      />

      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={handleReject}
        pending={rejectMutation.isPending}
        title="Tolak Form Stock Opname Ini?"
        description="Form akan ditandai DITOLAK. Stok sistem tidak akan diubah sama sekali."
        confirmLabel="Tolak Form"
      />

      <ConfirmDialog
        open={confirmRecount}
        onClose={() => setConfirmRecount(false)}
        onConfirm={handleRecount}
        pending={recountMutation.isPending}
        title="Buka Hitung Ulang (Recount)?"
        description="Sistem akan membuat Form SO baru bertautan (Recount ke-N) dengan daftar bahan baku yang sama dalam status OPEN untuk diaudit ulang."
        confirmLabel="Buat Form Recount"
      />
    </div>
  )
}

function KPICard({
  title,
  value,
  subtitle,
  tone = 'neutral',
  icon: Icon,
}: {
  title: string
  value: React.ReactNode
  subtitle: string
  tone?: 'neutral' | 'warning' | 'danger'
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border p-4 shadow-sm',
        tone === 'danger'
          ? 'border-danger/30 bg-danger-subtle/30 text-danger'
          : tone === 'warning'
          ? 'border-warning/30 bg-warning-subtle/30 text-warning-text'
          : 'border-border bg-surface text-fg',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-pos-xs font-semibold text-fg-muted uppercase tracking-wider">
          {title}
        </span>
        {Icon ? <Icon className="size-4 shrink-0 text-danger" aria-hidden="true" /> : null}
      </div>
      <div className="text-pos-lg font-bold text-fg pt-1">{value}</div>
      <p className="text-pos-xs text-fg-muted">{subtitle}</p>
    </div>
  )
}

function MaterialListTable({
  materials,
}: {
  materials: NonNullable<SOFormResponse['materials']>
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>No</TH>
          <TH>Bahan Baku</TH>
          <TH>Satuan Kemasan</TH>
          <TH>Base Unit</TH>
        </TR>
      </THead>
      <TBody>
        {materials.map((m, idx) => (
          <TR key={m.raw_material_id}>
            <TD className="text-fg-muted w-12">{idx + 1}</TD>
            <TD className="font-medium text-fg">{m.raw_material_name}</TD>
            <TD className="text-fg-muted">
              {m.package_unit && m.quantity_per_package
                ? `${m.package_unit} (isi ${formatQuantity(m.quantity_per_package)} ${m.unit})`
                : '—'}
            </TD>
            <TD className="text-fg-muted">{m.unit}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

function FinalSheetTable({ items }: { items: SOFinalSheetItem[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Bahan Baku</TH>
          <TH>Hitung Fisik</TH>
          <TH>Snapshot Sistem</TH>
          <TH numeric>Selisih Fisik</TH>
          <TH numeric>Nilai Selisih</TH>
          <TH>Status Indikator</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((it) => {
          const shortage = it.difference < 0
          return (
            <TR key={it.raw_material_id} className={cn(it.fraud_flag && 'bg-danger-subtle/30')}>
              <TD className="font-medium">
                <div>{it.raw_material_name}</div>
                <div className="text-pos-xs text-fg-muted">Base: {it.unit}</div>
              </TD>
              <TD>
                <div className="text-pos-sm font-semibold text-fg">
                  {formatQuantity(it.actual_stock)} {it.unit}
                </div>
                <div className="text-pos-xs text-fg-muted">
                  {it.actual_packages} kemasan · {formatQuantity(it.actual_loose)} {it.unit}
                </div>
              </TD>
              <TD>
                <div className="text-pos-sm text-fg">
                  {formatQuantity(it.system_stock)} {it.unit}
                </div>
                <div className="text-pos-xs text-fg-muted">
                  {it.system_packages ?? 0} kemasan · {formatQuantity(it.system_loose ?? 0)}{' '}
                  {it.unit}
                </div>
              </TD>
              <TD numeric>
                <span
                  className={cn(
                    'font-bold text-pos-sm',
                    it.difference === 0
                      ? 'text-fg-muted'
                      : shortage
                      ? 'text-danger'
                      : 'text-success-text',
                  )}
                >
                  {it.difference > 0 ? '+' : ''}
                  {formatQuantity(it.difference)} {it.unit}
                </span>
              </TD>
              <TD numeric>
                <Money
                  minor={toMinor(it.difference_value)}
                  size="sm"
                  signed
                  tone={shortage ? 'danger' : it.difference === 0 ? 'muted' : 'success'}
                />
              </TD>
              <TD>
                {it.fraud_flag ? (
                  <span className="inline-flex items-center gap-1 rounded bg-danger-subtle px-2 py-0.5 text-pos-xs font-bold text-danger border border-danger/30">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                    Fraud Alert
                  </span>
                ) : it.difference === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded bg-success-subtle px-2 py-0.5 text-pos-xs font-semibold text-success-text">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Cocok
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-neutral-subtle px-2 py-0.5 text-pos-xs font-medium text-fg-muted">
                    Wajar
                  </span>
                )}
              </TD>
            </TR>
          )
        })}
      </TBody>
    </Table>
  )
}

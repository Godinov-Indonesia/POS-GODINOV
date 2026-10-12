'use client'

import { ClipboardCheck, Eye, Plus, Send } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { FilterPillButton } from '@/components/ui/filter-button'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { usePublishSOForm, useSOForms } from '@/features/admin/inventory/hooks/useSOForms'
import { SOStatusBadge } from '@/features/admin/so/components/SOStatusBadge'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { formatDateTimeId } from '@/lib/time'
import type { SOFormResponse } from '@/lib/types/inventory'
import { cn } from '@/lib/utils/cn'

type FilterTab = 'ALL' | 'OPEN' | 'ACTIVE' | 'CLOSED' | 'FINISHED'

export function SOFormList() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Opname (SO)"
        description="Kelola jadwal dan pencatatan stock opname outlet. Pantau progres hitungan fisik staf serta setujui penyesuaian stok bahan baku."
        action={
          <Link
            href="/admin/inventory/opname/new"
            className={buttonVariants({ variant: 'primary' })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Buat Form SO Baru
          </Link>
        }
      />
      <OutletGuard>{(outletId) => <SOFormListInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function SOFormListInner({ outletId }: { outletId: string }) {
  const [tab, setTab] = React.useState<FilterTab>('ALL')
  const { data, isPending, error } = useSOForms(outletId)
  const publishMutation = usePublishSOForm(outletId)

  React.useEffect(() => {
    if (error) toastApiError(error, 'Gagal memuat daftar form SO')
  }, [error])

  const onQuickPublish = async (formId: string) => {
    try {
      await publishMutation.mutateAsync(formId)
      toast.success('Form SO berhasil diterbitkan')
    } catch (err) {
      toastApiError(err, 'Gagal mempublish form SO')
    }
  }

  if (isPending) return <SkeletonTable />

  const forms = (data ?? []).filter((f) => {
    if (tab === 'OPEN') return f.status === 'OPEN'
    if (tab === 'ACTIVE') return f.status === 'PUBLISHED' || f.status === 'COUNTING'
    if (tab === 'CLOSED') return f.status === 'CLOSED'
    if (tab === 'FINISHED') return f.status === 'APPROVED' || f.status === 'REJECTED'
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Tab Filter */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
        <FilterPillButton
          active={tab === 'ALL'}
          onClick={() => setTab('ALL')}
          badge={data?.length ?? 0}
        >
          Semua
        </FilterPillButton>
        <FilterPillButton
          active={tab === 'OPEN'}
          onClick={() => setTab('OPEN')}
          badge={(data ?? []).filter((f) => f.status === 'OPEN').length}
        >
          Draft
        </FilterPillButton>
        <FilterPillButton
          active={tab === 'ACTIVE'}
          onClick={() => setTab('ACTIVE')}
          badge={(data ?? []).filter((f) => f.status === 'PUBLISHED' || f.status === 'COUNTING').length}
        >
          Sedang Dihitung
        </FilterPillButton>
        <FilterPillButton
          active={tab === 'CLOSED'}
          onClick={() => setTab('CLOSED')}
          badge={(data ?? []).filter((f) => f.status === 'CLOSED').length}
        >
          Menunggu Review
        </FilterPillButton>
        <FilterPillButton
          active={tab === 'FINISHED'}
          onClick={() => setTab('FINISHED')}
          badge={(data ?? []).filter((f) => f.status === 'APPROVED' || f.status === 'REJECTED').length}
        >
          Selesai
        </FilterPillButton>
      </div>

      {!forms.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Tidak ada form SO pada filter ini"
          description="Buat form SO baru untuk memulai jadwal audit fisik bahan baku outlet."
          action={
            <Link
              href="/admin/inventory/opname/new"
              className={buttonVariants({ variant: 'primary' })}
            >
              Buat Form SO Baru
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>ID / Catatan Form</TH>
              <TH>Cakupan (Scope)</TH>
              <TH>Status</TH>
              <TH>Progres Fisik</TH>
              <TH>Waktu Dibuat</TH>
              <TH>Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {forms.map((form) => (
              <SOFormRow
                key={form.id}
                form={form}
                onPublish={() => onQuickPublish(form.id)}
                isPublishing={publishMutation.isPending}
              />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}


function SOFormRow({
  form,
  onPublish,
  isPublishing,
}: {
  form: SOFormResponse
  onPublish: () => void
  isPublishing: boolean
}) {
  const isRecount = form.recount_number > 0
  const total = form.count_progress?.total_materials ?? form.materials?.length ?? 0
  const counted = form.count_progress?.counted_materials ?? 0

  return (
    <TR>
      <TD className="font-medium">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/inventory/opname/${form.id}`}
            className="text-accent underline hover:text-accent-hover font-semibold"
          >
            {form.id.slice(0, 8)}…
          </Link>
          {isRecount ? (
            <span className="rounded bg-brand-subtle px-1.5 py-0.5 text-pos-xs font-semibold text-brand">
              Recount #{form.recount_number}
            </span>
          ) : null}
        </div>
        <p className="text-pos-xs text-fg-muted mt-0.5">
          {form.notes ? form.notes : 'Tanpa catatan'}
        </p>
      </TD>
      <TD>
        <span className="inline-block rounded border border-border px-2 py-0.5 text-pos-xs font-medium">
          {form.scope}
        </span>
      </TD>
      <TD>
        <SOStatusBadge status={form.status} />
      </TD>
      <TD>
        {form.status === 'OPEN' ? (
          <span className="text-pos-xs text-fg-muted">Draft (Belum Terbit)</span>
        ) : form.status === 'PUBLISHED' ? (
          <span className="text-pos-xs text-fg-muted">Belum ada hitungan</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-pos-sm font-medium">
              {counted} / {total} bahan
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent"
                style={{ width: `${total > 0 ? (counted / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </TD>
      <TD className="text-pos-sm text-fg-muted">{formatDateTimeId(form.created_at)}</TD>
      <TD>
        <div className="flex items-center gap-2">
          {form.status === 'OPEN' ? (
            <Button
              variant="primary"
              size="sm"
              disabled={isPublishing}
              onClick={onPublish}
            >
              <Send className="size-3.5 mr-1" aria-hidden="true" />
              Terbitkan
            </Button>
          ) : form.status === 'CLOSED' ? (
            <Link
              href={`/admin/inventory/opname/${form.id}`}
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
            >
              Review Hasil
            </Link>
          ) : (
            <Link
              href={`/admin/inventory/opname/${form.id}`}
              className={buttonVariants({ variant: 'neutral', size: 'sm' })}
            >
              <Eye className="size-3.5 mr-1" aria-hidden="true" />
              Detail
            </Link>
          )}
        </div>
      </TD>
    </TR>
  )
}

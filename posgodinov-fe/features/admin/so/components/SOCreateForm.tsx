'use client'

import { Check, ClipboardList, Layers, Search, Send, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatQuantity } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import { useCategories } from '@/features/admin/categories/hooks/useCategories'
import { useCreateSOForm, usePublishSOForm } from '@/features/admin/inventory/hooks/useSOForms'
import { useRawMaterials } from '@/features/admin/inventory/hooks/useRawMaterials'
import { useProducts } from '@/features/admin/products/hooks/useProducts'
import { OutletGuard } from '@/features/admin/shell/OutletGuard'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import type { SOScope } from '@/lib/types/inventory'
import { cn } from '@/lib/utils/cn'

export function SOCreateForm() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Buat Form Stock Opname"
        description="Pilih cakupan bahan baku yang akan diaudit fisik oleh staf di aplikasi SO Mobile."
      />
      <OutletGuard>{(outletId) => <SOCreateFormInner outletId={outletId} />}</OutletGuard>
    </div>
  )
}

function SOCreateFormInner({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { data: materials, isPending: loadingMaterials } = useRawMaterials(outletId)
  const { data: categories } = useCategories(outletId)
  const { data: products } = useProducts(outletId)

  const createFormMutation = useCreateSOForm(outletId)
  const publishMutation = usePublishSOForm(outletId)

  const [scope, setScope] = React.useState<SOScope>('FULL')
  const [selectedCategory, setSelectedCategory] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [partialSelectedIds, setPartialSelectedIds] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState<string>('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Map category -> Set of raw_material_ids via product recipes
  const categoryMaterialMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const p of products ?? []) {
      if (!p.category_id) continue
      if (!map.has(p.category_id)) {
        map.set(p.category_id, new Set())
      }
      const set = map.get(p.category_id)!
      for (const r of p.recipes ?? []) {
        set.add(r.raw_material_id)
      }
    }
    return map
  }, [products])

  // Dihitung langsung (derived state), tanpa memicu cascading renders di useEffect
  const selectedIds = React.useMemo(() => {
    if (scope === 'FULL') {
      return new Set((materials ?? []).map((m) => m.id))
    }
    if (scope === 'CATEGORY') {
      if (!selectedCategory || !categoryMaterialMap.has(selectedCategory)) {
        return new Set<string>()
      }
      const catSet = categoryMaterialMap.get(selectedCategory)!
      const validIds = (materials ?? []).filter((m) => catSet.has(m.id)).map((m) => m.id)
      return new Set(validIds)
    }
    return partialSelectedIds
  }, [scope, materials, selectedCategory, categoryMaterialMap, partialSelectedIds])

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setScope('PARTIAL')
    setPartialSelectedIds(next)
  }

  const selectAll = () => {
    if (!materials) return
    setScope('PARTIAL')
    setPartialSelectedIds(new Set(materials.map((m) => m.id)))
  }

  const deselectAll = () => {
    setScope('PARTIAL')
    setPartialSelectedIds(new Set())
  }

  const filteredMaterials = (materials ?? []).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSubmit = async (publishImmediately: boolean) => {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal satu bahan baku untuk diaudit.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createFormMutation.mutateAsync({
        scope,
        notes: notes.trim() || undefined,
        raw_material_ids: Array.from(selectedIds),
      })

      if (publishImmediately) {
        await publishMutation.mutateAsync(created.id)
        toast.success('Form SO berhasil dibuat dan diterbitkan ke mobile')
      } else {
        toast.success('Form SO berhasil disimpan sebagai Draft (OPEN)')
      }

      router.replace(`/admin/inventory/opname/${created.id}`)
    } catch (err) {
      toastApiError(err, 'Gagal membuat form SO')
      setIsSubmitting(false)
    }
  }

  if (loadingMaterials) return <Skeleton className="h-96 w-full max-w-4xl" />

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* Kartu Pengaturan Scope & Informasi */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-5">
          <Field label="Catatan / Nama Form (Opsional)" htmlFor="notes" hint="Misal: Opname Rutin Akhir Bulan, Audit Bar, dll.">
            <Input
              id="notes"
              placeholder="Contoh: Audit Mingguan Barista"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div>
            <label className="block text-pos-sm font-semibold text-fg mb-2">
              Pilih Cakupan Audit (Scope)
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <ScopeOption
                active={scope === 'FULL'}
                onClick={() => setScope('FULL')}
                icon={Layers}
                title="FULL (Semua Bahan)"
                description="Otomatis mencakup seluruh bahan baku aktif di outlet."
              />
              <ScopeOption
                active={scope === 'CATEGORY'}
                onClick={() => setScope('CATEGORY')}
                icon={Sparkles}
                title="CATEGORY (Per Menu)"
                description="Memfilter bahan berdasarkan resep BOM kategori produk."
              />
              <ScopeOption
                active={scope === 'PARTIAL'}
                onClick={() => {
                  setScope('PARTIAL')
                  setPartialSelectedIds(new Set(selectedIds))
                }}
                icon={ClipboardList}
                title="PARTIAL (Manual)"
                description="Pilih bahan baku spesifik satu per satu secara manual."
              />
            </div>
          </div>

          {/* Opsi Kategori jika Scope CATEGORY */}
          {scope === 'CATEGORY' ? (
            <div className="rounded-lg border border-accent/20 bg-accent-subtle/30 p-4">
              <label htmlFor="cat-select" className="block text-pos-sm font-semibold text-fg mb-1">
                Pilih Kategori Produk:
              </label>
              <select
                id="cat-select"
                aria-label="Pilih Kategori Produk"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-pos-sm focus:border-brand focus:outline-none"
              >
                <option value="">-- Pilih Kategori Produk --</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedCategory && (
                <p className="mt-2 text-pos-xs text-fg-muted">
                  {selectedIds.size} bahan baku resep BOM otomatis terpilih untuk kategori ini.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Tabel Pemilihan Bahan Baku */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-fg">
                Daftar Bahan Baku ({selectedIds.size} terpilih dari {materials?.length ?? 0})
              </h3>
              <p className="text-pos-xs text-fg-muted">
                Bahan yang dicentang akan dikirim ke aplikasi mobile untuk dihitung kasir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Pilih Semua
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Kosongkan
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-fg-muted" aria-hidden="true" />
            <Input
              placeholder="Cari nama bahan baku…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
            <Table>
              <THead>
                <TR>
                  <TH className="w-12 text-center">Pilih</TH>
                  <TH>Bahan Baku</TH>
                  <TH>Satuan Kemasan</TH>
                  <TH>Base Unit</TH>
                </TR>
              </THead>
              <TBody>
                {filteredMaterials.map((m) => {
                  const isChecked = selectedIds.has(m.id)
                  return (
                    <TR
                      key={m.id}
                      onClick={() => toggleItem(m.id)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isChecked ? 'bg-accent-subtle/20' : 'hover:bg-surface-subtle',
                      )}
                    >
                      <TD className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-4 accent-brand cursor-pointer rounded"
                          checked={isChecked}
                          onChange={() => toggleItem(m.id)}
                          aria-label={`Pilih ${m.name}`}
                        />
                      </TD>
                      <TD className="font-medium">{m.name}</TD>
                      <TD className="text-fg-muted">
                        {m.package_unit && m.quantity_per_package
                          ? `${m.package_unit} (isi ${formatQuantity(m.quantity_per_package)} ${m.unit})`
                          : '—'}
                      </TD>
                      <TD className="text-fg-muted">{m.unit}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tombol Aksi */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button variant="neutral" onClick={() => router.back()} disabled={isSubmitting}>
          Batal
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="neutral"
            size="lg"
            disabled={isSubmitting || selectedIds.size === 0}
            onClick={() => handleSubmit(false)}
          >
            Simpan Draft (OPEN)
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={isSubmitting || selectedIds.size === 0}
            onClick={() => handleSubmit(true)}
          >
            <Send className="size-4 mr-1.5" aria-hidden="true" />
            Simpan & Langsung Terbitkan
          </Button>
        </div>
      </div>
    </div>
  )
}

function ScopeOption({
  active,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-all',
        active
          ? 'border-brand bg-brand-subtle/10 ring-2 ring-brand shadow-sm'
          : 'border-border bg-surface hover:border-brand/40',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4', active ? 'text-brand' : 'text-fg-muted')} />
          <h4 className="text-pos-sm font-semibold text-fg">{title}</h4>
        </div>
        {active ? <Check className="size-4 text-brand font-bold" /> : null}
      </div>
      <p className="text-pos-xs text-fg-muted">{description}</p>
    </div>
  )
}

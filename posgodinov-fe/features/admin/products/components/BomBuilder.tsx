'use client'

import { AlertTriangle, Plus, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { NumericInput, Select } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import type { RawMaterialView } from '@/lib/types/domain'

export type BomRow = {
  /** Kunci baris lokal — bukan `product_recipes.id`; baris baru belum punya ID server. */
  key: string
  raw_material_id: string
  /** Disimpan sebagai string agar input desimal tidak "melompat" saat diketik. */
  quantity: string
}

export const newBomRow = (): BomRow => ({
  key: `row-${Math.random().toString(36).slice(2)}`,
  raw_material_id: '',
  quantity: '',
})

export const parseQuantity = (raw: string): number => {
  const value = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

/**
 * Penyusun resep (BOM) — docs/06 §3.9. Layar tersulit di seluruh sistem.
 *
 * Empat aturan yang ditegakkan di sini:
 * - Kolom **Satuan** dan **HPP/satuan** bersifat read-only; keduanya berasal
 *   dari bahan baku terpilih, bukan dari input pengguna.
 * - Pemilih bahan baku **menyaring** yang sudah dipakai baris lain — backend
 *   dan unique constraint DB sama-sama menolak bahan baku ganda.
 * - Bahan baku berstok negatif ditandai, **tidak diblokir**: stok minus adalah
 *   kondisi normal pada sistem ini ([03 §7.3]).
 * - Baris tanpa bahan baku terpilih dibuang saat submit, bukan ditolak —
 *   pengguna sering menekan "Tambah Bahan" lalu berubah pikiran.
 */
export function BomBuilder({
  rows,
  onChange,
  rawMaterials,
}: {
  rows: BomRow[]
  onChange: (rows: BomRow[]) => void
  rawMaterials: RawMaterialView[]
}) {
  const byId = React.useMemo(
    () => new Map(rawMaterials.map((m) => [m.id, m])),
    [rawMaterials],
  )

  const usedIds = React.useMemo(
    () => new Set(rows.map((r) => r.raw_material_id).filter(Boolean)),
    [rows],
  )

  const update = (key: string, patch: Partial<BomRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Penyusun Resep (BOM)</CardTitle>
        <Button variant="neutral" size="sm" onClick={() => onChange([...rows, newBomRow()])}>
          <Plus className="size-4" aria-hidden="true" />
          Tambah Bahan
        </Button>
      </CardHeader>

      <CardContent>
        {rawMaterials.length === 0 ? (
          <EmptyState
            title="Belum ada bahan baku"
            description="Tambahkan bahan baku terlebih dahulu agar resep dapat disusun. Produk tanpa resep tetap dapat dijual, tetapi stok tidak akan terpotong saat transaksi tersinkronisasi."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Produk tanpa resep"
            description="Boleh dikosongkan. Konsekuensinya: penjualan produk ini tidak memotong stok bahan baku apa pun."
            action={
              <Button variant="neutral" onClick={() => onChange([newBomRow()])}>
                Tambah Bahan
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-[1fr_7rem_5rem_8rem_8rem_3rem] gap-2 px-1 text-pos-xs uppercase tracking-wide text-fg-muted lg:grid">
              <span>Bahan baku</span>
              <span className="text-right">Jumlah</span>
              <span>Satuan</span>
              <span className="text-right">HPP/satuan</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {rows.map((row) => {
              const material = byId.get(row.raw_material_id)
              const quantity = parseQuantity(row.quantity)
              const subtotal = Math.round(quantity * (material?.cost_per_unit_minor ?? 0))
              const negativeStock = !!material && material.stock < 0

              return (
                <div
                  key={row.key}
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border border-border p-2 lg:grid-cols-[1fr_7rem_5rem_8rem_8rem_3rem] lg:border-0 lg:p-0"
                >
                  <div className="col-span-2 lg:col-span-1">
                    <Select
                      value={row.raw_material_id}
                      onChange={(e) => update(row.key, { raw_material_id: e.target.value })}
                      aria-label="Bahan baku"
                    >
                      <option value="">Pilih bahan baku…</option>
                      {rawMaterials
                        // Sembunyikan yang sudah dipakai baris lain, tetapi tetap
                        // tampilkan pilihan baris ini sendiri.
                        .filter((m) => m.id === row.raw_material_id || !usedIds.has(m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {m.stock < 0 ? ' (stok minus)' : ''}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <NumericInput
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => update(row.key, { quantity: e.target.value })}
                    aria-label="Jumlah"
                    placeholder="0"
                  />

                  <span className="text-pos-sm text-fg-muted">{material?.unit ?? '—'}</span>

                  <span className="text-right">
                    {material ? (
                      <Money minor={material.cost_per_unit_minor} size="sm" tone="muted" />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </span>

                  <span className="text-right">
                    {material ? <Money minor={subtotal} size="sm" /> : <span className="text-fg-subtle">—</span>}
                  </span>

                  <div className="flex items-center justify-end gap-1">
                    {negativeStock ? (
                      <AlertTriangle
                        className="size-4 text-warning-text"
                        aria-label="Stok bahan baku ini minus"
                      />
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger"
                      onClick={() => remove(row.key)}
                      aria-label="Hapus baris resep"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

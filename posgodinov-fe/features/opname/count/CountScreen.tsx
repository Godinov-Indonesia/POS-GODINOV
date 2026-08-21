'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { Check, PackageSearch, Search } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Num } from '@/components/ui/money'
import {
  clearLine,
  listLines,
  listMaterials,
  saveLine,
} from '@/features/opname/session/opname.repo'
import type { OpnameInputType, OpnameMaterial, OpnameSession } from '@/lib/db/opname-models'

/**
 * **Fase HITUNG** — status `DRAFT` ([11 §M16.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * APA YANG SENGAJA TIDAK ADA DI LAYAR INI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   ⛔ stok sistem            ⛔ selisih
 *   ⛔ indikator warna        ⛔ nilai rupiah
 *   ⛔ jumlah bahan "menyimpang"
 *
 * Ketiadaannya bukan disiplin penulisan komponen: tipe [OpnameMaterial] dan
 * [OpnameLine] secara harfiah tidak memiliki field untuk angka-angka itu,
 * dan `OpnameDraftDto` dari server pun tidak mengirimkannya. Menampilkannya di
 * sini tidak dapat dikompilasi.
 *
 * Alasannya satu kalimat: petugas yang tahu sistem mencatat 15,5 kg akan
 * mengetik 15,5 kg — apa pun isi raknya. Yang dicari opname justru hitungan
 * yang TIDAK dicocokkan.
 *
 * Bahkan indikator warna dilarang. Warna hijau pada baris yang "cocok" adalah
 * kebocoran ekspektasi yang paling halus dan paling efektif: ia tidak
 * menyebutkan angkanya, tetapi memberi tahu petugas kapan harus berhenti
 * menghitung ulang.
 */
export function CountScreen({
  session,
  blindMode,
  onRequestLock,
}: {
  session: OpnameSession
  /**
   * `config.blind_opname_enabled` ([11 §M18.2]).
   *
   * ⚠️ Hanya mengubah SALINAN peringatan, bukan data. Respons `DRAFT` dari
   * server tidak pernah memuat stok sistem — `OpnameItemDraftDTO` tidak
   * memiliki field itu — sehingga `false` tidak dapat memunculkan angka yang
   * tidak dikirim siapa pun.
   */
  blindMode: boolean
  onRequestLock: () => void
}) {
  const materials = useLiveQuery(() => listMaterials(), [], undefined)
  const lines = useLiveQuery(() => listLines(session.id), [session.id], [])
  const [query, setQuery] = React.useState('')

  // `Map` dibangun sekali per render, bukan `.find()` per baris: opname penuh
  // menyentuh ratusan bahan, dan pencarian linier di dalam daftar berarti
  // ratusan × ratusan perbandingan setiap kali satu angka diketik.
  const countedById = React.useMemo(
    () => new Map(lines.map((l) => [l.raw_material_id, l])),
    [lines],
  )

  if (materials === undefined) return <Skeleton className="m-4 h-96" />

  if (materials.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Belum ada data bahan baku"
        description="Perangkat ini belum mengunduh katalog bahan baku. Sambungkan ke jaringan lalu tarik data master terlebih dahulu."
      />
    )
  }

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? materials.filter((m) => m.name.toLowerCase().includes(needle))
    : materials

  const countedTotal = countedById.size

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {blindMode ? (
        <Banner tone="info" title="Hitung apa adanya">
          Isi jumlah fisik yang benar-benar Anda temukan di rak. Aplikasi sengaja tidak menampilkan
          catatan sistem — selisih baru muncul setelah hitungan dikunci, dan tidak dapat diubah
          setelahnya.
        </Banner>
      ) : (
        // `blind_opname_enabled: false` tidak memunculkan angka sistem — ia
        // hanya menghapus penjelasan MENGAPA angka itu tidak ada. Spanduk ini
        // menyatakan keadaan sesungguhnya alih-alih diam, karena petugas yang
        // mengira aplikasinya rusak akan menghubungi teknisi tanpa perlu.
        <Banner tone="warning" title="Mode blind opname dimatikan pemilik">
          Angka sistem tetap tidak ditampilkan selama penghitungan — server memang tidak
          mengirimkannya sebelum sesi dikunci. Menonaktifkan mode ini sepenuhnya memerlukan
          perubahan pada sisi server.
        </Banner>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Cari bahan baku"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/*
          Hitungan PROGRES, bukan hitungan selisih. "87 dari 120 bahan" memberi
          tahu petugas berapa banyak pekerjaan tersisa; ia tidak memberi tahu
          apa pun tentang benar atau salahnya angka yang sudah diisi.
        */}
        <Badge tone="neutral">
          <Num>{countedTotal}</Num>/<Num>{materials.length}</Num> dihitung
        </Badge>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((material) => (
          <CountRow
            key={material.id}
            material={material}
            counted={countedById.get(material.id)?.counted ?? null}
            inputType={countedById.get(material.id)?.input_type ?? 'base_unit'}
            onSave={(counted, inputType) =>
              saveLine({
                sessionId: session.id,
                rawMaterialId: material.id,
                counted,
                inputType,
              })
            }
            onClear={() => clearLine(session.id, material.id)}
          />
        ))}
      </ul>

      <Button
        variant="primary"
        size="xl"
        block
        disabled={countedTotal === 0}
        onClick={onRequestLock}
      >
        <Check className="size-5" aria-hidden="true" />
        SELESAI MENGHITUNG
      </Button>
    </div>
  )
}

/**
 * Satu baris bahan baku.
 *
 * `null` pada [counted] berarti **belum dihitung** — berbeda dari `0`, yang
 * berarti bahannya habis. Perbedaan itu satu-satunya cara petugas tahu apa yang
 * masih tersisa dikerjakan di gudang seluas itu, dan karena itu ia ditampilkan
 * secara eksplisit alih-alih diperlakukan sebagai kotak kosong.
 */
function CountRow({
  material,
  counted,
  inputType,
  onSave,
  onClear,
}: {
  material: OpnameMaterial
  counted: number | null
  inputType: OpnameInputType
  onSave: (counted: number, inputType: OpnameInputType) => Promise<void>
  onClear: () => Promise<void>
}) {
  const [draft, setDraft] = React.useState(counted === null ? '' : String(counted))
  const [unit, setUnit] = React.useState<OpnameInputType>(inputType)

  const hasPackage = material.package_unit !== null && (material.quantity_per_package ?? 0) > 0

  const commit = (raw: string, nextUnit: OpnameInputType) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      void onClear()
      return
    }
    const value = Number(trimmed.replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) return
    void onSave(value, nextUnit)
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-pos-base font-medium text-fg">{material.name}</span>
        {counted === null ? (
          <Badge tone="warning">Belum dihitung</Badge>
        ) : (
          // Netral, BUKAN hijau. Lencana hijau mengisyaratkan "benar", dan
          // tidak ada yang benar atau salah sebelum penguncian — hanya sudah
          // atau belum dihitung.
          <Badge tone="neutral">Terisi</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          className="h-14 flex-1 text-right text-pos-lg font-semibold"
          placeholder="—"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft, unit)}
          aria-label={`Hitungan fisik ${material.name}`}
        />

        {/*
          Dukungan satuan paket ([11 §M16.2], `input_type` dari migrasi 000014).
          Petugas menghitung "3 dus", bukan "72 kaleng" — memaksanya mengalikan
          sendiri adalah cara paling mudah menghasilkan selisih yang bukan
          selisih sungguhan.
        */}
        {hasPackage ? (
          <div className="flex overflow-hidden rounded-lg border border-border">
            <UnitToggle
              active={unit === 'base_unit'}
              label={material.unit}
              onClick={() => {
                setUnit('base_unit')
                commit(draft, 'base_unit')
              }}
            />
            <UnitToggle
              active={unit === 'package_unit'}
              label={material.package_unit ?? 'paket'}
              onClick={() => {
                setUnit('package_unit')
                commit(draft, 'package_unit')
              }}
            />
          </div>
        ) : (
          <span className="w-20 shrink-0 text-pos-sm text-fg-muted">{material.unit}</span>
        )}
      </div>
    </li>
  )
}

function UnitToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-14 px-3 text-pos-sm font-medium transition-colors ${
        active ? 'bg-accent text-fg-inverse' : 'bg-surface text-fg-muted'
      }`}
    >
      {label}
    </button>
  )
}

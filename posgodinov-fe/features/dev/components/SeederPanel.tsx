'use client'

import { AlertTriangle, Database, Server, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Money, Num, formatPercent } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { toast, toastApiError } from '@/components/ui/toaster'
import {
  SEED_OUTLET,
  SEED_PRODUCTS,
  SEED_RAW_MATERIALS,
  SEED_STAFFS,
  SEED_SUMMARY,
  seedHppMinor,
} from '@/lib/seed/fixtures'
import { SeedGuardError, seedViaApi } from '@/lib/seed/seed-api'
import { resetSeed, seedDexie } from '@/lib/seed/seed-dexie'

/**
 * Panel seeder — hanya untuk lingkungan pengembangan.
 *
 * Dexie hanya ada di peramban, sehingga seeder offline **tidak dapat**
 * dijalankan sebagai skrip Node. Panel ini adalah pemicunya.
 */
export function SeederPanel() {
  const [outletId, setOutletId] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  const runDexie = async () => {
    setBusy('dexie')
    try {
      const result = await seedDexie()
      toast.success(
        `IndexedDB terisi: ${result.staffs} staff, ${result.categories} kategori, ` +
          `${result.products} produk (hash bcrypt ${result.hashMs}ms)`,
      )
    } catch (error) {
      toastApiError(error, 'Gagal mengisi IndexedDB')
    } finally {
      setBusy(null)
    }
  }

  const runApi = async () => {
    if (!outletId.trim()) return
    setBusy('api')
    try {
      const result = await seedViaApi(outletId.trim())
      toast.success(
        `Backend terisi: ${result.categories} kategori, ${result.rawMaterials} bahan baku, ` +
          `${result.products} produk, ${result.staffs} staff`,
      )
      for (const note of result.skipped) toast.warning(note)
    } catch (error) {
      if (error instanceof SeedGuardError) toast.error(error.message)
      else toastApiError(error, 'Gagal mengisi backend')
    } finally {
      setBusy(null)
    }
  }

  const runReset = async () => {
    setBusy('reset')
    try {
      const result = await resetSeed()
      toast.success(
        `${result.masterRowsCleared} baris master dihapus. ` +
          `${result.transactionalRowsKept} baris transaksional dipertahankan.`,
      )
    } catch (error) {
      toastApiError(error, 'Gagal mengosongkan IndexedDB')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-pos-xl font-bold text-fg">Data Seeder — Lingkungan Uji</h1>
        <p className="text-pos-sm text-fg-muted">
          {SEED_OUTLET.name} · <span className="font-mono">{SEED_OUTLET.serial_tenant}</span>
        </p>
      </div>

      <Banner tone="danger" icon={AlertTriangle} title="Hanya untuk lingkungan pengembangan">
        Halaman ini tidak tersedia pada build produksi. Jangan pernah menjalankannya terhadap
        tenant yang berisi data nyata.
      </Banner>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" aria-hidden="true" />
              IndexedDB (POS offline)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-pos-sm text-fg-muted">
              Mengisi <code>staffs</code>, <code>categories</code>, dan <code>products</code>, lalu
              menulis device token <strong>palsu</strong> agar aplikasi kasir terbuka penuh tanpa
              binding. Sinkronisasi ke server akan ditolak <code>401</code> — itu disengaja.
            </p>
            <Button variant="primary" onClick={runDexie} disabled={busy !== null}>
              {busy === 'dexie' ? 'Mengisi…' : 'Isi IndexedDB'}
            </Button>
            <Button variant="danger" onClick={runReset} disabled={busy !== null}>
              <Trash2 className="size-4" aria-hidden="true" />
              {busy === 'reset' ? 'Mengosongkan…' : 'Kosongkan master data'}
            </Button>
            <p className="text-pos-xs text-fg-muted">
              Pengosongan tidak menyentuh <code>shifts</code>, <code>transactions</code>, maupun{' '}
              <code>wastes</code> — itu data keuangan.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" aria-hidden="true" />
              Backend (API Admin)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-pos-sm text-fg-muted">
              Memerlukan sesi Admin yang aktif. Seeder menolak berjalan bila outlet sudah berisi
              data — kategori ganda <strong>tidak dapat dihapus</strong> lewat API mana pun.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-pos-sm font-medium text-fg">ID Outlet tujuan</span>
              <Input
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                placeholder={SEED_OUTLET.id}
                className="font-mono"
              />
            </label>
            <Button
              variant="primary"
              onClick={runApi}
              disabled={busy !== null || !outletId.trim()}
            >
              {busy === 'api' ? 'Mengirim…' : 'Kirim ke Backend'}
            </Button>
            <p className="text-pos-xs text-fg-muted">
              ID kategori dan bahan baku dibangkitkan server, sehingga resep dipetakan berdasarkan
              nama.
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-2 text-pos-lg font-semibold text-fg">
        Isi fixture — {SEED_SUMMARY.categories} kategori · {SEED_SUMMARY.rawMaterials} bahan baku ·{' '}
        {SEED_SUMMARY.products} produk · {SEED_SUMMARY.staffs} kasir
      </h2>

      <Table>
        <THead>
          <TR>
            <TH>Produk</TH>
            <TH numeric>Harga jual</TH>
            <TH numeric>HPP</TH>
            <TH numeric>Margin</TH>
            <TH numeric>%</TH>
            <TH numeric>Resep</TH>
          </TR>
        </THead>
        <TBody>
          {SEED_PRODUCTS.map((product) => {
            const hpp = seedHppMinor(product)
            const margin = product.price_minor - hpp
            return (
              <TR key={product.id}>
                <TD className="font-medium">{product.name}</TD>
                <TD numeric>
                  <Money minor={product.price_minor} size="sm" />
                </TD>
                <TD numeric>
                  <Money minor={hpp} size="sm" tone="muted" />
                </TD>
                <TD numeric>
                  <Money minor={margin} size="sm" tone={margin < 0 ? 'danger' : 'success'} />
                </TD>
                <TD numeric>
                  <Num>{formatPercent((margin / product.price_minor) * 100)}</Num>
                </TD>
                <TD numeric>
                  <Num>{product.recipes.length}</Num>
                </TD>
              </TR>
            )
          })}
        </TBody>
      </Table>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kasir uji</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-pos-sm">
              {SEED_STAFFS.map((staff) => (
                <li key={staff.id} className="flex items-center justify-between">
                  <span>{staff.name}</span>
                  <span className="font-mono text-fg-muted">
                    {staff.staff_identifier} · PIN {staff.pin}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bahan baku</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-pos-sm">
              {SEED_RAW_MATERIALS.map((material) => (
                <li key={material.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{material.name}</span>
                  <span className="shrink-0 text-fg-muted">
                    <Num>{material.stock}</Num> {material.unit} ·{' '}
                    <Money minor={material.cost_per_unit_minor} size="sm" tone="muted" />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

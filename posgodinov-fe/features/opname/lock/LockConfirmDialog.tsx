'use client'

import { Lock } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/feedback'
import { Num } from '@/components/ui/money'

/**
 * Konfirmasi kunci **dua langkah** ([11 §M16.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RINGKASAN JUMLAH ITEM SAJA — TIDAK ADA YANG LAIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dialog ini menampilkan berapa bahan yang sudah dihitung dan berapa yang
 * belum. Itu saja.
 *
 * ⛔ Tidak ada "berapa yang menyimpang". Angka itu saja — tanpa menyebut bahan
 * mana atau berapa besarnya — sudah cukup memberi tahu petugas bahwa
 * hitungannya "salah", dan ia akan kembali menghitung ulang sampai angkanya
 * nol. Seluruh Blind Opname runtuh oleh satu bilangan bulat.
 *
 * Yang justru ditampilkan adalah bahan yang BELUM dihitung, karena itu
 * informasi tentang pekerjaannya sendiri — bukan tentang hasilnya.
 */
export function LockConfirmDialog({
  open,
  countedTotal,
  materialTotal,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  countedTotal: number
  materialTotal: number
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const uncounted = Math.max(0, materialTotal - countedTotal)

  return (
    <Dialog open={open} onClose={onClose} title="Kunci hitungan sekarang?" tone="danger">
      <div className="flex flex-col gap-3">
        <Banner tone="warning" title="Penguncian tidak dapat dibatalkan">
          Setelah dikunci, hitungan <strong>tidak dapat diubah lagi</strong>. Selisih akan
          ditampilkan, dan perbaikan hanya mungkin lewat sesi hitung ulang yang baru.
        </Banner>

        <dl className="flex flex-col gap-2 rounded-xl border border-border bg-bg-muted p-4 text-pos-sm">
          <div className="flex items-center justify-between">
            <dt className="text-fg-muted">Bahan sudah dihitung</dt>
            <dd className="font-semibold text-fg">
              <Num>{countedTotal}</Num>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-fg-muted">Belum dihitung</dt>
            <dd className="font-semibold text-fg">
              <Num>{uncounted}</Num>
            </dd>
          </div>
          {/*
            ⛔ JANGAN menambahkan baris "bahan menyimpang" di sini.
            Lihat catatan pada kepala komponen — satu bilangan itu cukup untuk
            membatalkan seluruh fase ini.
          */}
        </dl>

        {uncounted > 0 ? (
          <p className="text-pos-sm text-fg-muted">
            Bahan yang belum dihitung <strong>tidak</strong> ikut terkunci dan tidak akan muncul di
            hasil. Pastikan itu memang yang Anda inginkan.
          </p>
        ) : null}

        <p className="rounded-lg border border-border bg-surface p-3 text-pos-sm text-fg-muted">
          Penguncian memerlukan jaringan sekali: catatan sistem diambil server tepat pada momen ini,
          bukan saat Anda mulai menghitung.
        </p>

        {error ? (
          <p role="alert" className="text-pos-sm text-danger">
            ⚠ {error}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-3">
          <Button variant="neutral" size="lg" onClick={onClose} disabled={busy}>
            Lanjut Menghitung
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            onClick={onConfirm}
            disabled={busy || countedTotal === 0}
          >
            <Lock className="size-5" aria-hidden="true" />
            {busy ? 'Mengunci…' : 'Kunci & Hitung Selisih'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

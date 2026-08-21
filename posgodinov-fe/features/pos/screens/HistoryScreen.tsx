'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban, Check, Receipt, Search, X } from 'lucide-react'
import * as React from 'react'

import { Badge, SyncBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Money, Num, shortId } from '@/components/ui/money'
import {
  lookupByCode,
  LOOKUP_LIMIT,
  MIN_CODE_LENGTH,
  type LookupResult,
} from '@/features/pos/history/receipt-lookup'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { LocalTransaction } from '@/lib/db/models'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import {
  listAllTransactions,
  listTransactionsOfShift,
} from '@/lib/db/repositories/transaction.repo'
import { readPosConfig } from '@/lib/pos/config'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-09 Riwayat Transaksi — **butir 16** ([11 §M17.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HANYA SHIFT BERJALAN. TAB "SEBELUMNYA" DIHAPUS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tab "Sebelumnya" yang menampilkan 50 transaksi terakhir dari server
 * **dihapus dari kode**, bukan disembunyikan. Ia memperlihatkan transaksi kasir
 * lain kepada kasir yang sedang bertugas — dan layar ini adalah pintu masuk ke
 * Void dan Retur. Kasir sore yang dapat melihat transaksi shift pagi dapat
 * membatalkannya, dengan selisih kas jatuh ke orang yang sudah pulang.
 *
 * Tab "Hari Ini" pun tidak cukup: satu hari memuat dua sampai tiga shift.
 * Kueri kini memakai indeks komposit `[shift_id+client_created_at]` pada shift
 * yang benar-benar terbuka.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SATU-SATUNYA JALAN KE MASA LALU ADALAH KODE STRUK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pelanggan yang datang membawa struk kemarin tetap harus dapat dilayani. Yang
 * berubah adalah bentuk aksesnya: kasir harus MENGETAHUI kode yang dicarinya,
 * bukan menelusuri daftar. Hasilnya satu transaksi — tidak pernah daftar.
 *
 * ⚠️ Transaksi hasil pencarian dapat **diretur** (M13), tetapi tidak dapat
 * **di-void**: struknya sudah tercetak dan berpindah tangan, dan butir 15
 * melarang membatalkan dokumen yang sudah ada di tangan pelanggan.
 */
export function HistoryScreen() {
  const shift = useLiveQuery(() => getOpenShift(), [], undefined)

  // ── FEATURE FLAG `history_scope` ([11 §M18.2]) ─────────────────────────
  //
  // Bawaan `'ACTIVE_SHIFT'` — dan bawaan itu KETAT dengan sengaja. Perangkat
  // yang belum pernah menarik `config` dari server memakai perilaku v2 penuh;
  // kebijakan longgar secara bawaan berarti outlet yang syncnya tertinggal
  // berjalan tanpa isolasi riwayat tanpa ada yang menyadarinya.
  //
  // `'ALL'` adalah jalan mundur ke perilaku v1 untuk satu bisnis yang belum
  // siap, tanpa menuntut *rollback* rilis.
  const scope = useLiveQuery(async () => (await readPosConfig()).historyScope, [], undefined)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Riwayat Shift Ini</h1>
      </div>

      <ReceiptSearch />

      {scope === undefined || shift === undefined ? (
        <Skeleton className="h-64" />
      ) : scope === 'ALL' ? (
        <AllHistory />
      ) : !shift ? (
        <Banner tone="warning" title="Tidak ada shift terbuka">
          Riwayat terikat pada shift yang sedang berjalan. Buka shift terlebih dahulu.
        </Banner>
      ) : (
        <ShiftHistory shiftId={shift.id} />
      )}
    </div>
  )
}

/** Daftar transaksi shift berjalan. */
function ShiftHistory({ shiftId }: { shiftId: string }) {
  const transactions = useLiveQuery(
    () => listTransactionsOfShift(shiftId),
    [shiftId],
    undefined,
  )

  if (transactions === undefined) return <Skeleton className="h-64" />

  if (!transactions.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="Belum ada transaksi pada shift ini"
        description="Transaksi shift sebelumnya tidak ditampilkan. Gunakan pencarian kode struk bila pelanggan membawa struk lama."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} />
      ))}
    </ul>
  )
}

/**
 * Riwayat TANPA isolasi shift — hanya aktif pada `history_scope: 'ALL'`
 * ([11 §M18.2]).
 *
 * Menampilkan spanduk yang menyatakan keadaan itu apa adanya. Kasir berhak tahu
 * bahwa ia sedang melihat transaksi rekannya, dan pemilik berhak melihat bahwa
 * outletnya berjalan dengan pengendalian yang dimatikan.
 */
function AllHistory() {
  const transactions = useLiveQuery(() => listAllTransactions(), [], undefined)

  if (transactions === undefined) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-2">
      <Banner tone="warning" title="Isolasi riwayat sedang dimatikan">
        Outlet ini disetel menampilkan transaksi dari seluruh shift
        (<code>history_scope: ALL</code>). Perilaku bawaan v2 membatasi riwayat pada shift
        berjalan.
      </Banner>

      {transactions.length === 0 ? (
        <EmptyState icon={Receipt} title="Belum ada transaksi di perangkat ini" />
      ) : (
        <ul className="flex flex-col gap-2">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Kolom pencarian kode struk.
 *
 * Dipisah menjadi komponen sendiri supaya state-nya tidak ikut dirender ulang
 * setiap kali `useLiveQuery` daftar transaksi memancar — yang terjadi pada
 * setiap transaksi baru selama jam sibuk.
 */
function ReceiptSearch() {
  const [code, setCode] = React.useState('')
  const [result, setResult] = React.useState<LookupResult | null>(null)
  const [searching, setSearching] = React.useState(false)

  const tooShort = code.trim().length > 0 && code.trim().length < MIN_CODE_LENGTH

  const search = async () => {
    setSearching(true)
    try {
      setResult(await lookupByCode(code))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <Input
            className="pl-9 font-mono"
            placeholder="Kode struk atau UUID transaksi"
            aria-label="Cari kode struk"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              // Hasil lama dibuang begitu kasir mengetik lagi. Membiarkannya
              // membuat hasil pencarian sebelumnya tampak seperti hasil untuk
              // kode yang sedang diketik.
              if (result) setResult(null)
            }}
          />
        </div>
        <Button
          type="submit"
          variant="neutral"
          size="lg"
          disabled={searching || code.trim().length < MIN_CODE_LENGTH}
        >
          {searching ? 'Mencari…' : 'Cari'}
        </Button>
      </form>

      {tooShort ? (
        <p className="text-pos-xs text-fg-muted">
          Minimal <Num>{MIN_CODE_LENGTH}</Num> karakter. Pencarian yang lebih pendek akan menjaring
          transaksi yang tidak Anda cari.
        </p>
      ) : null}

      {result ? <LookupOutcome result={result} onDismiss={() => setResult(null)} /> : null}
    </div>
  )
}

function LookupOutcome({
  result,
  onDismiss,
}: {
  result: LookupResult
  onDismiss: () => void
}) {
  switch (result.status) {
    case 'found':
      return (
        <div className="flex flex-col gap-2 rounded-xl border border-accent bg-accent-subtle p-3">
          <div className="flex items-center justify-between">
            <span className="text-pos-sm font-semibold text-fg">
              Hasil pencarian
              {result.source === 'server' ? ' · dari server' : ' · tersimpan di perangkat'}
            </span>
            <Button variant="ghost" size="icon" aria-label="Tutup hasil" onClick={onDismiss}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {/* `fromLookup` menandai baris ini sebagai transaksi LUAR shift:
              tombol Void disembunyikan, Retur tetap ada (butir 15). */}
          <TransactionRow transaction={result.transaction} fromLookup />
        </div>
      )

    case 'not-found':
      return (
        <Banner tone="warning" title="Transaksi tidak ditemukan">
          Periksa kembali kode pada struk. Kode dari outlet lain tidak dapat dicari dari perangkat
          ini.
        </Banner>
      )

    case 'too-short':
      return (
        <Banner tone="warning">
          Kode terlalu pendek — minimal <Num>{MIN_CODE_LENGTH}</Num> karakter.
        </Banner>
      )

    case 'rate-limited':
      return (
        <Banner tone="warning" title="Terlalu banyak pencarian">
          Batas <Num>{LOOKUP_LIMIT}</Num> pencarian per menit tercapai. Coba lagi dalam{' '}
          <Num>{Math.ceil(result.retryAfterMs / 1000)}</Num> detik.
        </Banner>
      )

    case 'offline':
      return (
        <Banner tone="danger" title="Tidak dapat menghubungi server">
          Transaksi lampau memerlukan jaringan. Riwayat shift berjalan tetap tersedia offline.
        </Banner>
      )
  }
}

function TransactionRow({
  transaction,
  fromLookup = false,
}: {
  transaction: LocalTransaction
  fromLookup?: boolean
}) {
  const cancelled = transaction.status === 'VOIDED' || transaction.status === 'CANCELLED'

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <Num className="font-semibold">
            {transaction.short_code ?? shortId(transaction.id)}
          </Num>
          {cancelled ? (
            <Badge tone="danger" icon={Ban}>
              Dibatalkan
            </Badge>
          ) : (
            <Badge tone="success" icon={Check}>
              Selesai
            </Badge>
          )}
          <SyncBadge state={transaction._synced === 1 ? 'synced' : 'pending'} />
        </span>
        <span className="text-pos-xs text-fg-muted">
          {formatDateTimeId(transaction.client_created_at)} ·{' '}
          <Num>{transaction.items.length}</Num> item
        </span>
      </div>

      <Money
        minor={transaction.total_amount}
        size="lg"
        tone={cancelled ? 'muted' : 'default'}
      />

      <Button
        variant="neutral"
        onClick={() => posNavigate('receipt', { transactionId: transaction.id })}
      >
        Struk
      </Button>

      {/*
        Retur BOLEH, Void TIDAK — butir 15 ([11 §2.1]).

        Transaksi hasil pencarian berasal dari shift lain; struknya sudah
        tercetak dan berpindah tangan ke pelanggan. Membatalkannya berarti
        menerbitkan realitas kedua yang bertentangan dengan kertas di tangan
        pelanggan. Retur adalah peristiwa keuangan BARU yang tidak mengubah
        transaksi asal, dan karena itu tetap sah.
      */}
      {fromLookup && !cancelled ? (
        <Button
          variant="neutral"
          onClick={() => posNavigate('return', { transactionId: transaction.id })}
        >
          Retur
        </Button>
      ) : null}
    </li>
  )
}

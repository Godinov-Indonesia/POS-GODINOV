'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Money, Num, shortId } from '@/components/ui/money'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { useSyncStore } from '@/features/pos/sync/sync-store'
import { useCanAttemptNetwork, useConnectivityStatus } from '@/features/pos/sync/useConnectivity'
import { runManualSync } from '@/features/pos/sync/useSyncEngine'
import type { LocalTransaction } from '@/lib/db/models'
import { countUnsyncedShifts } from '@/lib/db/repositories/shift.repo'
import {
  countQuarantinedReturns,
  countQuarantinedSecurityEvents,
  countQuarantinedTransactions,
  countQuarantinedVoidLogs,
  countQuarantinedWastes,
  countUnsyncedReturns,
  countUnsyncedSecurityEvents,
  countUnsyncedTransactions,
  countUnsyncedVoidLogs,
  countUnsyncedWastes,
  listFailedTransactions,
  listQuarantinedTransactions,
} from '@/lib/db/repositories/transaction.repo'
import { CONNECTIVITY_LABEL } from '@/lib/sync/connectivity-store'
import { formatDateTimeId } from '@/lib/time'

/**
 * P-13 Status Sinkronisasi — docs/05 §1.6.6.
 *
 * Menyatakan dua batasan secara eksplisit kepada operator:
 * 1. Sinkronisasi **hanya berjalan saat aplikasi terbuka** (ADR-06).
 * 2. Kegagalan shift tidak dilaporkan per-ID, sehingga peringatannya agregat.
 */
export function SyncStatusScreen() {
  const connectivity = useConnectivityStatus()
  const canAttempt = useCanAttemptNetwork()
  const syncing = useSyncStore((s) => s.syncing)
  const lastError = useSyncStore((s) => s.lastError)
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt)
  const lastSkipped = useSyncStore((s) => s.lastSkipped)
  const deviceRejected = useSyncStore((s) => s.deviceRejected)

  const counts = useLiveQuery(
    async () => ({
      transactions: await countUnsyncedTransactions(),
      shifts: await countUnsyncedShifts(),
      wastes: await countUnsyncedWastes(),
      returns: await countUnsyncedReturns(),
      voidLogs: await countUnsyncedVoidLogs(),
      securityEvents: await countUnsyncedSecurityEvents(),
    }),
    [],
    { transactions: 0, shifts: 0, wastes: 0, returns: 0, voidLogs: 0, securityEvents: 0 },
  )

  /** Kelompok ketiga — baris yang ditolak server secara PERMANEN ([11 §4.3]). */
  const quarantined = useLiveQuery(
    async () => ({
      transactions: await countQuarantinedTransactions(),
      wastes: await countQuarantinedWastes(),
      returns: await countQuarantinedReturns(),
      voidLogs: await countQuarantinedVoidLogs(),
      securityEvents: await countQuarantinedSecurityEvents(),
    }),
    [],
    { transactions: 0, wastes: 0, returns: 0, voidLogs: 0, securityEvents: 0 },
  )

  const failed = useLiveQuery(() => listFailedTransactions(), [], [] as LocalTransaction[])
  const blocked = useLiveQuery(() => listQuarantinedTransactions(), [], [] as LocalTransaction[])

  const queued =
    counts.transactions +
    counts.shifts +
    counts.wastes +
    counts.returns +
    counts.voidLogs +
    counts.securityEvents

  const quarantinedTotal =
    quarantined.transactions +
    quarantined.wastes +
    quarantined.returns +
    quarantined.voidLogs +
    quarantined.securityEvents

  // "Antre" adalah baris yang belum pernah gagal. Menghitungnya sebagai
  // `total - gagal` mencegah satu baris muncul di dua kelompok sekaligus —
  // kasir yang melihat angka yang sama dua kali akan berhenti mempercayainya.
  const waiting = Math.max(0, queued - failed.length)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Status Sinkronisasi</h1>
      </div>

      {deviceRejected ? (
        <Banner tone="danger" icon={ShieldAlert} title="Perangkat ditolak server">
          <p>
            Token pemasangan perangkat ini tidak sah atau sudah dicabut, sehingga sinkronisasi
            otomatis dihentikan — mencoba terus tidak akan berhasil sampai perangkat dipasang ulang.
          </p>
          <p className="mt-1">
            <strong>Data penjualan tetap aman di perangkat</strong> dan akan terkirim setelah
            pemasangan ulang berhasil. Tidak ada yang hilang.
          </p>
          <p className="mt-1">Dua penyebab yang paling sering:</p>
          <ul className="mt-0.5 list-inside list-disc">
            <li>Perangkat diisi data uji lewat seeder, yang menulis token contoh — bukan token asli.</li>
            <li>Pemasangan dilakukan ke server lain, atau kunci token server telah berganti.</li>
          </ul>
          <a href="/pos/bind" className="mt-2 inline-block font-semibold underline">
            Buka Halaman Pemasangan Perangkat →
          </a>
        </Banner>
      ) : (
        <Banner tone="warning" title="Sinkronisasi hanya berjalan saat aplikasi terbuka">
          Biarkan aplikasi ini terbuka sampai antrean kosong. Menutup tab menghentikan pengiriman —
          data tetap aman di perangkat, tetapi belum sampai ke server.
        </Banner>
      )}

      {/* ── TIGA KELOMPOK ANTREAN ([11 §M12.3]) ─────────────────────────────
          Pembagiannya bukan kosmetik: hanya kelompok ketiga yang menuntut
          manusia. Menyatukan ketiganya membuat satu baris cacat permanen
          tersembunyi di antara seratus baris yang akan beres sendiri. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <GroupCard
          tone="neutral"
          label="Antre"
          value={waiting}
          hint="Menunggu giliran kirim. Tidak ada yang perlu dilakukan."
        />
        <GroupCard
          tone="warning"
          label="Gagal (akan diulang)"
          value={failed.length}
          hint="Mesin mencoba lagi otomatis dengan jeda yang membesar."
        />
        <GroupCard
          tone="danger"
          label="Butuh tindakan"
          value={quarantinedTotal}
          hint="Ditolak server secara permanen — mengirim ulang tidak akan berhasil."
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-border bg-surface p-3 text-pos-sm sm:grid-cols-3">
        <Row label="Transaksi">
          <Num>{counts.transactions}</Num>
        </Row>
        <Row label="Shift">
          <Num>{counts.shifts}</Num>
        </Row>
        <Row label="Waste">
          <Num>{counts.wastes}</Num>
        </Row>
        <Row label="Retur">
          <Num>{counts.returns}</Num>
        </Row>
        <Row label="Pembatalan">
          <Num>{counts.voidLogs}</Num>
        </Row>
        <Row label="Audit keamanan">
          <Num>{counts.securityEvents}</Num>
        </Row>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="xl"
          onClick={() => void runManualSync()}
          disabled={syncing || !canAttempt}
        >
          <RefreshCw className={syncing ? 'size-5 animate-spin' : 'size-5'} aria-hidden="true" />
          {syncing ? 'MENYINKRONKAN…' : deviceRejected ? 'COBA LAGI' : 'SINKRONKAN SEKARANG'}
        </Button>

        {/* `degraded` sengaja TIDAK mematikan tombol: menekannya adalah
            satu-satunya cara mengetahui captive portal sudah dilewati. */}
        {connectivity === 'offline' ? (
          <Badge tone="neutral">Perangkat offline — akan otomatis dicoba saat online</Badge>
        ) : connectivity === 'degraded' ? (
          <Badge tone="warning">
            {CONNECTIVITY_LABEL.degraded} — jaringan terdeteksi, tetapi server belum menjawab
          </Badge>
        ) : null}
      </div>

      <dl className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-pos-sm">
        <Row label="Terakhir berhasil">
          {lastSuccessAt ? formatDateTimeId(lastSuccessAt) : 'Belum pernah'}
        </Row>
        {lastSkipped ? <Row label="Dilewati">{SKIP_LABEL[lastSkipped]}</Row> : null}
        {lastError ? (
          <Row label="Galat terakhir">
            <span className="text-danger">{lastError}</span>
          </Row>
        ) : null}
      </dl>

      {counts.shifts > 0 && queued > 0 ? (
        <Banner tone="warning" icon={AlertTriangle} title="Shift belum tersimpan di server">
          Backend tidak melaporkan shift mana yang gagal, hanya jumlahnya. Selama shift induknya
          belum pasti tersimpan, transaksi pada shift itu <strong>sengaja tidak</strong> ditandai
          tersinkron — menandainya lebih awal adalah cara termudah kehilangan data penjualan.
        </Banner>
      ) : null}

      {blocked.length > 0 ? (
        <>
          <h2 className="mt-2 text-pos-base font-semibold text-danger">
            Butuh tindakan — ditolak permanen
          </h2>
          <Banner tone="danger" icon={ShieldAlert} title="Baris ini tidak akan terkirim sendiri">
            Server menolaknya dengan alasan yang <strong>tidak berubah</strong> berapa kali pun
            dikirim ulang — misalnya pembayaran kartu tanpa nomor trace, atau retur yang melebihi
            jumlah aslinya. Baris ini sudah dikeluarkan dari antrean supaya tidak menahan baris di
            belakangnya. <strong>Datanya tetap tersimpan di perangkat</strong>; laporkan ke
            supervisor beserta kode struk di bawah.
          </Banner>
          <ul className="flex flex-col gap-2">
            {blocked.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} tone="danger" />
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="mt-2 text-pos-base font-semibold text-fg">Gagal — akan diulang otomatis</h2>
      {failed.length === 0 ? (
        <EmptyState title="Tidak ada transaksi yang gagal" />
      ) : (
        <ul className="flex flex-col gap-2">
          {failed.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} tone="warning" />
          ))}
        </ul>
      )}

      <p className="text-pos-xs text-fg-muted">
        {deviceRejected
          ? 'Percobaan otomatis dihentikan sampai perangkat dipasang ulang. Tidak ada baris yang dibuang — seluruh antrean menunggu di perangkat.'
          : 'Baris yang berulang kali gagal tidak pernah dibuang. Mesin akan terus mencoba dengan jeda yang membesar hingga maksimal 5 menit. Baris "Butuh tindakan" pun tetap tersimpan — ia hanya berhenti diantre agar tidak menahan yang lain.'}
      </p>
    </div>
  )
}

const SKIP_LABEL = {
  locked: 'Tab lain sedang menyinkronkan',
  backoff: 'Menunggu jeda setelah kegagalan',
  offline: 'Perangkat offline',
  empty: 'Tidak ada yang perlu dikirim',
} as const

/** Kartu satu kelompok antrean. Nilai nol tetap ditampilkan — ketiadaan angka
 *  lebih membingungkan daripada angka nol. */
function GroupCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: 'neutral' | 'warning' | 'danger'
}) {
  // Warna SAJA tidak pernah menjadi satu-satunya penanda ([06 §1.5]); teks
  // `hint` di bawah angka membawa arti yang sama.
  const toneClass =
    value === 0
      ? 'border-border bg-surface'
      : tone === 'danger'
        ? 'border-danger/40 bg-danger-subtle'
        : tone === 'warning'
          ? 'border-warning/40 bg-warning-subtle'
          : 'border-border bg-surface'

  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-pos-sm text-fg-muted">{label}</span>
        <Num className="text-pos-xl font-semibold">{value}</Num>
      </div>
      <span className="text-pos-xs text-fg-muted">{hint}</span>
    </div>
  )
}

function TransactionRow({
  transaction,
  tone,
}: {
  transaction: LocalTransaction
  tone: 'warning' | 'danger'
}) {
  const border = tone === 'danger' ? 'border-danger/30 bg-danger-subtle' : 'border-warning/30 bg-warning-subtle'

  return (
    <li className={`flex items-center gap-3 rounded-xl border p-3 ${border}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <Num className="font-semibold">{transaction.short_code ?? shortId(transaction.id)}</Num>
        <span className="text-pos-xs text-fg-muted">
          {formatDateTimeId(transaction.client_created_at)} ·{' '}
          <Num>{transaction._syncAttempts}</Num> percobaan
        </span>
        {transaction._syncError ? (
          <span className={tone === 'danger' ? 'text-pos-xs text-danger' : 'text-pos-xs text-fg-muted'}>
            {transaction._syncError}
          </span>
        ) : null}
      </div>
      <Money minor={transaction.total_amount} size="md" />
    </li>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

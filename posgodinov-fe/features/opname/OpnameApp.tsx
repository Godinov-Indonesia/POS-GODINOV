'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Play } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { toast } from '@/components/ui/toaster'
import { CountScreen } from '@/features/opname/count/CountScreen'
import { LockConfirmDialog } from '@/features/opname/lock/LockConfirmDialog'
import { lockSession } from '@/features/opname/lock/lock-session'
import { ResultScreen } from '@/features/opname/result/ResultScreen'
import {
  countMaterials,
  createSession,
  listLines,
  listSessions,
} from '@/features/opname/session/opname.repo'
import { useOpnameServiceWorker } from '@/features/opname/useOpnameServiceWorker'
import { readOpnameConfig } from '@/features/opname/session/opname-config'
import type { OpnameSession } from '@/lib/db/opname-models'

/**
 * Akar modul Opname Gudang — **butir 3 & 4** ([11 §M16]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DUA FASE, SATU ARAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   DRAFT  → CountScreen   · hanya menerima hitungan fisik
 *   LOCKED → ResultScreen  · selisih, nilai rupiah, penanda ambang
 *
 * Pemilihan layar diturunkan dari `session.status`, bukan dari state navigasi.
 * Router yang dapat "kembali" ke layar hitung akan membuat sesi terkunci dapat
 * dibuka lagi lewat tombol back — dan sifat satu arah yang membuat angka
 * hitungan dapat dipercaya hilang bersamanya.
 *
 * ⛔ Berkas ini dan seluruh `features/opname/**` **dilarang** mengimpor apa pun
 * dari `features/pos/**`. Ditegakkan `no-restricted-imports` dua arah di
 * `eslint.config.mjs`, dan diperkuat oleh database Dexie yang berbeda.
 */
export function OpnameApp() {
  useOpnameServiceWorker()

  const sessions = useLiveQuery(() => listSessions(), [], undefined)
  const materialTotal = useLiveQuery(() => countMaterials(), [], 0)

  const [creating, setCreating] = React.useState(false)

  if (sessions === undefined) {
    return (
      <div className="flex min-h-dvh flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  // Sesi paling baru yang belum selesai. Sesi `APPROVED`/`REJECTED` adalah
  // arsip: keduanya tidak lagi dapat disentuh dari perangkat gudang.
  const active = sessions.find((s) => s.status === 'DRAFT' || s.status === 'LOCKED')

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <OpnameHeader session={active} />

      {active === undefined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <EmptyState
            icon={ClipboardList}
            title="Belum ada sesi opname berjalan"
            description="Mulai sesi baru untuk menghitung fisik bahan baku. Hitungan tersimpan di perangkat dan dapat dilanjutkan tanpa jaringan."
          />
          <Button
            variant="primary"
            size="xl"
            disabled={creating}
            onClick={async () => {
              setCreating(true)
              try {
                // Sesi dibuat LOKAL lebih dulu, tanpa menyentuh jaringan.
                //
                // Gudang sering tanpa sinyal, dan menuntut jaringan untuk
                // memulai berarti pekerjaan itu tidak dapat dimulai sama
                // sekali. Sesi menyusul ke server saat penguncian.
                await createSession()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Gagal membuka sesi opname.')
              } finally {
                setCreating(false)
              }
            }}
          >
            <Play className="size-5" aria-hidden="true" />
            {creating ? 'Membuka…' : 'MULAI SESI OPNAME'}
          </Button>
        </div>
      ) : active.status === 'DRAFT' ? (
        <DraftPhase session={active} materialTotal={materialTotal} />
      ) : (
        <ResultScreen session={active} />
      )}
    </div>
  )
}

/**
 * Fase hitung beserta dialog penguncinya.
 *
 * Dipisah menjadi komponen sendiri supaya state dialog lahir dan mati bersama
 * sesi: dialog yang tertinggal terbuka setelah penguncian akan menawarkan
 * mengunci sesi yang sudah terkunci.
 */
function DraftPhase({
  session,
  materialTotal,
}: {
  session: OpnameSession
  materialTotal: number
}) {
  const lines = useLiveQuery(() => listLines(session.id), [session.id], [])

  // ── FEATURE FLAG `blind_opname_enabled` ([11 §M18.2]) ──────────────────
  //
  // ⚠️ BATASNYA NYATA DAN HARUS DINYATAKAN. Mematikan flag ini **tidak**
  // memunculkan stok sistem selama fase hitung, dan tidak dapat: respons
  // `DRAFT` dari server memakai `OpnameItemDraftDTO`, yang secara harfiah tidak
  // memiliki field `system_stock` ([11 §4.6]). Tidak ada nilai yang dapat
  // ditampilkan klien karena tidak ada nilai yang dikirim.
  //
  // Yang benar-benar dikendalikan flag ini adalah **salinan peringatan** —
  // apakah petugas diberi tahu bahwa angka sistem sengaja disembunyikan.
  //
  // Konsekuensinya bagi rilis: mencabut Blind Opname sepenuhnya menuntut
  // perubahan DTO di server, bukan pembalikan flag. Flag ini tidak dapat
  // dipakai sebagai jalan mundur darurat untuk butir 3 — lihat laporan M18.2.
  const blind = useLiveQuery(async () => (await readOpnameConfig()).blindOpnameEnabled, [], true)
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const outcome = await lockSession(session.id)
      if (!outcome.ok) {
        setError(outcome.error)
        return
      }
      setConfirming(false)
      // Tanpa satu angka pun. Selisihnya ada di ResultScreen, yang mengambil
      // alih sendiri begitu status sesi berpindah ke `LOCKED`.
      toast.success('Hitungan terkunci.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <CountScreen
        session={session}
        blindMode={blind}
        onRequestLock={() => setConfirming(true)}
      />
      <LockConfirmDialog
        open={confirming}
        countedTotal={lines.length}
        materialTotal={materialTotal}
        busy={busy}
        error={error}
        onClose={() => {
          setConfirming(false)
          setError(null)
        }}
        onConfirm={confirm}
      />
    </>
  )
}

function OpnameHeader({ session }: { session: OpnameSession | undefined }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <ClipboardList className="size-5 text-fg-muted" aria-hidden="true" />
      <span className="text-pos-base font-bold text-fg">Opname Gudang</span>

      {/*
        Status ditampilkan sebagai KATA, bukan warna saja. Petugas gudang perlu
        tahu apakah ia masih boleh mengubah hitungan, dan itu terlalu penting
        untuk disampaikan lewat satu titik berwarna.
      */}
      {session ? (
        <span className="ml-auto text-pos-sm text-fg-muted">
          {session.status === 'DRAFT' ? 'Sedang menghitung' : 'Terkunci'}
        </span>
      ) : null}
    </header>
  )
}

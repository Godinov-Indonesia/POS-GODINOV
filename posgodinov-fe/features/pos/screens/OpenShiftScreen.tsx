'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Download, Lock } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { Skeleton } from '@/components/ui/feedback'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { recordPosSecurityEvent } from '@/features/pos/security/record-event'
import { SECURITY_EVENT } from '@/lib/constants/security-events'
import { getDeviceId } from '@/lib/auth/device-session'
import { openShift } from '@/lib/db/repositories/shift.repo'
import {
  evaluateMasterGate,
  MASTER_GATE_MESSAGE,
  type MasterGateVerdict,
} from '@/lib/pos/master-gate'
import { readPosConfig } from '@/lib/pos/config'
import { syncMasterData } from '@/lib/sync/master-sync'

/**
 * P-04 Buka Shift — docs/04 §A.3, digerbangi pada Fase M15.1 (**butir 10**).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * GERBANG MENDAHULUI FORMULIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Formulir modal awal **tidak dirender sama sekali** sebelum gerbang lolos.
 * Bukan dinonaktifkan, bukan ditutupi overlay: kasir yang melihat formulir yang
 * ditolak akan mencoba jalan lain, dan salah satunya cepat atau lambat berhasil.
 *
 * Jalur masuk mana pun berakhir di sini — termasuk deep link `#open-shift`,
 * karena gerbangnya hidup di dalam komponen layar, bukan di dalam penekanan
 * tombol yang menuju ke sini.
 *
 * **Tidak ada tombol "Lewati".** Lihat catatan pada `lib/pos/master-gate.ts`.
 */
export function OpenShiftScreen() {
  // `useLiveQuery`, bukan `useEffect` + `useState`.
  //
  // Putusan gerbang seluruhnya diturunkan dari isi Dexie — `master.lastSyncAt`,
  // `master.version`, `master.serverVersion`, dan blok `config`. Menjadikannya
  // kueri hidup berarti penarikan master data yang berhasil **langsung**
  // membuka gerbang, tanpa satu pun panggilan balik yang harus diingat
  // seseorang untuk dipasang.
  const verdict = useLiveQuery(() => evaluateMasterGate(), [], undefined)

  useGateRejectionLog(verdict)

  if (verdict === undefined) return <Skeleton className="m-4 h-96" />
  if (!verdict.ok) return <MasterDataBlocker verdict={verdict} />

  return <OpenShiftForm masterDataVersion={verdict.version} />
}

/**
 * Mencatat `OPEN_SHIFT_BLOCKED_STALE_MASTER` saat gerbang menolak ([11 §M15.1]).
 *
 * Dipisah menjadi hook tersendiri supaya pencatatannya tidak ikut berjalan di
 * dalam `useLiveQuery` — kueri yang menulis ke basis data yang sedang
 * diamatinya akan memicu evaluasi ulang, dan evaluasi ulang menulis lagi.
 *
 * `seen` menahan alasan yang sudah dicatat pada sesi layar ini. Tanpanya, satu
 * kunjungan menghasilkan satu baris audit per render — dan sinyal yang
 * sesungguhnya (outlet ini menabrak gerbang setiap pagi) tenggelam di antara
 * ratusan duplikat.
 */
function useGateRejectionLog(verdict: MasterGateVerdict | undefined): void {
  const seen = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!verdict || verdict.ok) return
    if (seen.current === verdict.reason) return
    seen.current = verdict.reason

    void recordPosSecurityEvent({
      eventType: SECURITY_EVENT.OPEN_SHIFT_BLOCKED_STALE_MASTER,
      details: {
        reason: verdict.reason,
        age_minutes: verdict.ageMinutes,
        max_age_minutes: verdict.maxAgeMinutes,
        held_version: verdict.version,
        server_version: verdict.serverVersion,
      },
    })
  }, [verdict])
}

/**
 * Layar pemblokir — **bukan spinner di sudut** ([11 §M15.1]).
 *
 * Menempati seluruh layar dengan sengaja. Indikator kecil di pojok akan
 * diabaikan oleh kasir yang sedang membuka toko, dan pesan yang diabaikan sama
 * saja dengan pesan yang tidak pernah ada.
 */
function MasterDataBlocker({ verdict }: { verdict: MasterGateVerdict }) {
  const [pulling, setPulling] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const pull = async () => {
    setPulling(true)
    setError(null)
    try {
      // Tidak ada evaluasi ulang manual di sini: `syncMasterData` menulis ke
      // Dexie, dan `useLiveQuery` di pemanggil membaca ulang gerbangnya
      // sendiri. Memaksanya dari sini justru membuka peluang dua putusan yang
      // berbeda hidup berdampingan.
      await syncMasterData()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Tidak dapat menghubungi server. Periksa jaringan outlet lalu coba lagi.',
      )
    } finally {
      setPulling(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-[30rem] max-w-full flex-col gap-4 rounded-2xl border border-danger/30 bg-surface p-6 shadow-elevated">
        <div className="flex flex-col items-center gap-2 text-center">
          <Lock className="size-8 text-danger" aria-hidden="true" />
          <h1 className="text-pos-lg font-bold text-fg">SHIFT BELUM DAPAT DIBUKA</h1>
          <p className="text-pos-base text-fg-muted">
            {MASTER_GATE_MESSAGE[verdict.reason as Exclude<typeof verdict.reason, 'ok'>]}
          </p>
        </div>

        <p className="rounded-lg border border-border bg-bg-muted p-3 text-pos-sm text-fg-muted">
          Berjualan dengan harga yang sudah tidak berlaku tidak dapat dikoreksi setelah pelanggan
          pulang. Karena itu unduhan ini wajib, dan tidak dapat dilewati.
        </p>

        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-pos-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <Button variant="primary" size="xl" block onClick={pull} disabled={pulling}>
          <Download className="size-5" aria-hidden="true" />
          {pulling ? 'Mengunduh…' : 'UNDUH DATA & COBA LAGI'}
        </Button>

        {/*
          Satu-satunya jalan keluar adalah MUNDUR, bukan maju. Kasir yang tidak
          dapat mengunduh masih boleh kembali ke Login — perangkat lain di
          outlet yang sama mungkin sudah punya master data yang segar.
        */}
        <Button variant="ghost" onClick={() => posNavigate('login')} disabled={pulling}>
          Kembali ke Login
        </Button>
      </div>
    </div>
  )
}

/**
 * Formulir modal awal.
 *
 * Hanya dirender setelah gerbang lolos, dan menerima [masterDataVersion] dari
 * putusan gerbang itu — bukan membacanya lagi sendiri. Pembacaan kedua akan
 * mengambil versi yang berbeda bila master ditarik ulang di antara keduanya,
 * dan shift akan mengklaim versi yang tidak pernah dipakai memutuskan apa pun.
 */
function OpenShiftForm({ masterDataVersion }: { masterDataVersion: number | null }) {
  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)
  const { digits, append, backspace, clear } = useDigitInput(9)
  const [saving, setSaving] = React.useState(false)

  const openingMinor = digitsToMinor(digits)

  const submit = async () => {
    if (!staffId) return
    setSaving(true)
    try {
      const [deviceId, config] = await Promise.all([getDeviceId(), readPosConfig()])

      await openShift({
        staffId,
        openingBalanceMinor: openingMinor,
        masterDataVersion,
        deviceId,
        blindClose: config.blindCloseEnabled,
      })
      posNavigate('register')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuka shift.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-[26rem] max-w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-elevated">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-pos-lg font-bold text-fg">BUKA SHIFT</h1>
          <p className="text-pos-sm text-fg-muted">Kasir: {staffName ?? '—'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-pos-sm font-medium text-fg">Modal awal laci</span>
          <div className="flex h-20 items-center justify-end rounded-md border border-border-strong bg-bg-muted px-4">
            <Money minor={openingMinor} size="2xl" />
          </div>
        </div>

        <Keypad onDigit={append} onClear={clear} onBackspace={backspace} disabled={saving} />

        <p className="text-pos-xs text-fg-muted">
          Hitung uang fisik di laci sekarang. Angka ini tidak dapat diubah setelah shift berjalan.
        </p>

        <Button variant="primary" size="xl" block onClick={submit} disabled={saving || !staffId}>
          {saving ? 'Membuka…' : 'BUKA SHIFT'}
        </Button>
      </div>
    </div>
  )
}

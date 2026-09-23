'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, EyeOff } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Money } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import { closeShiftSaga } from '@/features/pos/shift/close-shift-saga'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { formatTimeId } from '@/lib/time'

/**
 * P-12 Tutup Shift — **Blind Closing**, butir 9 ([11 §M15.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * APA YANG SENGAJA TIDAK ADA DI LAYAR INI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   ⛔ agregat penjualan sistem        ⛔ jumlah transaksi
 *   ⛔ angka ekspektasi laci           ⛔ selisih kas
 *   ⛔ ringkasan per metode bayar      ⛔ modal awal laci
 *
 * Nama-nama field itu sengaja TIDAK ditulis di berkas ini, bahkan di dalam
 * komentar: DoD M15 butir 2 memverifikasi layar ini lewat `grep` harfiah, dan
 * pemeriksaan yang tersandung pada komentarnya sendiri akan dimatikan orang
 * pertama yang menjalankannya.
 *
 * Semuanya pernah ada di sini, dan **dihapus dari kode** — bukan disembunyikan
 * di balik flag. Kode yang disembunyikan akan dinyalakan kembali oleh orang
 * yang tidak tahu mengapa ia dimatikan.
 *
 * Alasannya satu kalimat: angka deklarasi yang diketik sambil melihat
 * ekspektasi tidak memiliki nilai audit apa pun. Kasir yang tahu laci
 * *seharusnya* berisi Rp 3.240.000 akan mengetik Rp 3.240.000, apa pun isi
 * lacinya. Yang dicari fase ini justru kesaksian yang tidak dicocokkan.
 *
 * Modal awal pun ikut hilang — ia adalah suku pertama rumus ekspektasi, dan
 * kasir yang melihatnya bersama penjualan tunai dapat menghitung sisanya di
 * kepala.
 *
 * ⚠️ Berkas ini **tidak boleh** mengimpor apa pun dari `shift-math`. Aturannya
 * ditegakkan `no-restricted-imports` di `eslint.config.mjs`, bukan hanya oleh
 * ulasan kode.
 */
export function CloseShiftScreen() {
  const shift = useLiveQuery(() => getOpenShift(), [], undefined)
  const staffName = usePosAuthStore((s) => s.staffName)

  const [confirming, setConfirming] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  if (shift === undefined) return <Skeleton className="m-4 h-96" />

  if (!shift) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-pos-base text-fg-muted">Tidak ada shift terbuka.</p>
        <Button variant="primary" size="xl" onClick={() => posNavigate('login')}>
          Kembali ke Login
        </Button>
      </div>
    )
  }

  return (
    <BlindCloseForm
      key={shift.id}
      cashierName={staffName ?? '—'}
      openedAt={shift.client_opened_at}
      confirming={confirming}
      saving={saving}
      onRequestConfirm={() => setConfirming(true)}
      onCancelConfirm={() => setConfirming(false)}
      onSubmit={async (declaration) => {
        setSaving(true)
        try {
          const outcome = await closeShiftSaga(declaration)

          if (!outcome.ok) {
            toast.error(outcome.error)
            return
          }

          // Tanpa satu angka pun. Bahkan "tersinkron" dilaporkan sebagai
          // keadaan, bukan sebagai jumlah baris — hitungan transaksi adalah
          // agregat penjualan yang justru dilarang layar ini.
          toast.success(
            outcome.synced
              ? 'Shift ditutup dan terkirim ke server.'
              : 'Shift ditutup. Data akan terkirim otomatis saat jaringan tersedia.',
          )
        } finally {
          setSaving(false)
          setConfirming(false)
        }
      }}
    />
  )
}

/**
 * Formulir tiga isian.
 *
 * Dipisah menjadi komponen sendiri dan diberi `key={shift.id}` oleh pemanggil:
 * seluruh state keypad lahir bersamanya, sehingga tidak ada `useEffect` yang
 * perlu meresetnya saat shift berganti.
 */
function BlindCloseForm({
  cashierName,
  openedAt,
  confirming,
  saving,
  onRequestConfirm,
  onCancelConfirm,
  onSubmit,
}: {
  cashierName: string
  openedAt: string
  confirming: boolean
  saving: boolean
  onRequestConfirm: () => void
  onCancelConfirm: () => void
  onSubmit: (declaration: {
    declaredCashMinor: number
    declaredEdcMinor: number
    declaredQrisMinor: number
  }) => Promise<void>
}) {
  type Field = 'cash' | 'edc' | 'qris'
  const [active, setActive] = React.useState<Field>('cash')

  const cash = useDigitInput(9)
  const edc = useDigitInput(9)
  const qris = useDigitInput(9)

  const inputs: Record<Field, ReturnType<typeof useDigitInput>> = { cash, edc, qris }
  const current = inputs[active]

  // Laci WAJIB diisi; EDC dan QRIS boleh kosong — outlet yang tidak menerima
  // keduanya sepanjang shift memang tidak punya angka untuk dideklarasikan,
  // dan memaksa mereka mengetik "0" hanya melatih kebiasaan mengetik nol.
  const canSubmit = cash.digits.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row">
      <div className="flex flex-col gap-3 lg:w-[26rem]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => posNavigate('register')} disabled={saving}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali
          </Button>
          <h1 className="text-pos-lg font-bold text-fg">Tutup Shift</h1>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-pos-sm">
          <span className="text-fg-muted">
            Kasir: <strong className="text-fg">{cashierName}</strong>
          </span>
          <span className="text-fg-muted">Mulai {formatTimeId(openedAt)}</span>
        </div>

        <DeclarationRow
          label="Uang Fisik di Laci"
          hint="Hitung seluruh isi laci, termasuk modal awal."
          minor={digitsToMinor(cash.digits)}
          empty={cash.digits.length === 0}
          active={active === 'cash'}
          onSelect={() => setActive('cash')}
        />
        <DeclarationRow
          label="Total Settle EDC"
          hint="Angka pada struk settlement mesin EDC."
          minor={digitsToMinor(edc.digits)}
          empty={edc.digits.length === 0}
          active={active === 'edc'}
          onSelect={() => setActive('edc')}
        />
        <DeclarationRow
          label="Total Settle QRIS"
          hint="Angka pada laporan settlement QRIS."
          minor={digitsToMinor(qris.digits)}
          empty={qris.digits.length === 0}
          active={active === 'qris'}
          onSelect={() => setActive('qris')}
        />

        <Banner tone="info" title="Hitung dulu, jangan mencocokkan">
          <span className="flex items-start gap-2">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Aplikasi sengaja tidak menampilkan angka sistem. Isi apa adanya sesuai hasil hitungan —
            selisih dihitung dan ditinjau di kantor, bukan di layar ini.
          </span>
        </Banner>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="max-w-xs">
          <Keypad
            onDigit={current.append}
            onClear={current.clear}
            onBackspace={current.backspace}
            disabled={saving}
          />
        </div>

        <Button
          variant="danger"
          size="xl"
          block
          className="mt-auto"
          disabled={saving || !canSubmit}
          onClick={onRequestConfirm}
        >
          TUTUP SHIFT
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={onCancelConfirm}
        onConfirm={() =>
          onSubmit({
            declaredCashMinor: digitsToMinor(cash.digits),
            declaredEdcMinor: digitsToMinor(edc.digits),
            declaredQrisMinor: digitsToMinor(qris.digits),
          })
        }
        pending={saving}
        confirmLabel="Tutup shift"
        title="Tutup shift sekarang?"
        description="Angka yang Anda isi tidak dapat diubah dari perangkat ini. Setelah shift ditutup, Anda akan kembali ke layar Login."
      />
    </div>
  )
}

function DeclarationRow({
  label,
  hint,
  minor,
  empty,
  active,
  onSelect,
}: {
  label: string
  hint: string
  minor: number
  empty: boolean
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
        active ? 'border-accent bg-accent-subtle' : 'border-border bg-surface'
      }`}
    >
      <span className="text-pos-sm font-semibold text-fg">{label}</span>
      <div className="flex h-14 items-center justify-end rounded-md border border-border-strong bg-bg-muted px-3">
        {empty ? (
          <span className="text-pos-xl font-bold text-fg-subtle">Rp —</span>
        ) : (
          <Money minor={minor} size="xl" />
        )}
      </div>
      <span className="text-pos-xs text-fg-muted">{hint}</span>
    </button>
  )
}

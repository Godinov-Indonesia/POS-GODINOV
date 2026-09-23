'use client'

import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { SUPERVISOR_MESSAGE, verifySupervisor } from '@/features/pos/auth/supervisor'
import { forceCloseShift, FORCE_CLOSE_MIN_REASON } from '@/features/pos/shift/force-close'

/**
 * Jalur darurat Force Close Shift — **butir 12** ([11 §M15.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA JALUR INI HARUS ADA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Identity Lock mengunci perangkat selama ada shift `OPEN`. Tanpa jalan keluar,
 * kasir yang pulang tanpa menutup shift mengunci perangkat itu **selamanya** —
 * dan outlet membuka hari berikutnya dengan mesin kasir yang tidak dapat
 * dipakai siapa pun.
 *
 * Tiga hal yang membuatnya tetap menjadi jalur darurat, bukan pintu belakang:
 *
 *   1. PIN supervisor, bukan PIN kasir yang sedang login
 *   2. Alasan wajib, minimal 10 karakter — bukan daftar pilihan yang dapat
 *      diketuk tanpa berpikir
 *   3. `pos_security_events` **CRITICAL** yang muncul di dashboard pemilik
 *
 * ⚠️ Tidak ada isian angka kas di sini, dan itu disengaja. Force Close berarti
 * tidak ada yang menghitung laci: mengisi angka deklarasi atas nama orang yang
 * sudah pulang justru menciptakan kesaksian palsu. Shift ditutup dengan
 * deklarasi nol, dan `blind_close: false` menandai bahwa angkanya memang bukan
 * hasil hitungan siapa pun.
 */
export function ForceCloseSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Tutup Paksa Shift" tone="danger">
      {/*
        Isian hanya dirender saat terbuka: state-nya lahir dan mati bersama
        dialog, sehingga PIN supervisor tidak menganggur di memori setelah
        dialog ditutup — dan tidak ada `useEffect` yang perlu meresetnya.
      */}
      {open ? <ForceCloseForm onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  )
}

function ForceCloseForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [identifier, setIdentifier] = React.useState('')
  const [pin, setPin] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const trimmedReason = reason.trim()
  const canSubmit =
    identifier.trim().length > 0 &&
    pin.length > 0 &&
    trimmedReason.length >= FORCE_CLOSE_MIN_REASON

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const verdict = await verifySupervisor(identifier.trim(), pin)
      if (!verdict.ok) {
        setError(SUPERVISOR_MESSAGE[verdict.reason])
        setPin('')
        return
      }

      const outcome = await forceCloseShift({
        supervisorId: verdict.staff.id,
        supervisorName: verdict.staff.name,
        reason: trimmedReason,
      })

      if (!outcome.ok) {
        setError(outcome.error)
        return
      }

      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Banner tone="danger" title="Tindakan ini tercatat sebagai peristiwa kritis">
        <span className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Shift akan ditutup <strong>tanpa</strong> hitungan laci. Pemilik akan melihat siapa yang
          menutupnya dan alasannya. Gunakan hanya bila kasir pemilik shift benar-benar tidak dapat
          dihubungi.
        </span>
      </Banner>

      <Field label="ID Supervisor" htmlFor="force-close-id" required>
        <Input
          id="force-close-id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field label="PIN Supervisor" htmlFor="force-close-pin" required>
        <Input
          id="force-close-pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Alasan penutupan paksa"
        htmlFor="force-close-reason"
        required
        hint={
          // Sisa karakter ditampilkan, bukan sekadar tombol yang mati. Tombol
          // mati tanpa penjelasan membuat supervisor mengira aplikasinya rusak.
          trimmedReason.length > 0 && trimmedReason.length < FORCE_CLOSE_MIN_REASON
            ? `Kurang ${FORCE_CLOSE_MIN_REASON - trimmedReason.length} karakter lagi.`
            : `Minimal ${FORCE_CLOSE_MIN_REASON} karakter. Alasan ini dibaca pemilik, bukan sistem.`
        }
      >
        <Textarea
          id="force-close-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Contoh: kasir Andi pulang pukul 21.00 tanpa menutup shift, laci sudah diamankan supervisor"
        />
      </Field>

      {error ? (
        <p role="alert" className="text-pos-sm text-danger">
          ⚠ {error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        <Button variant="neutral" size="lg" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="danger"
          size="lg"
          className="flex-1"
          onClick={submit}
          disabled={!canSubmit || busy}
        >
          {busy ? 'Menutup…' : 'Tutup Paksa Shift'}
        </Button>
      </div>
    </div>
  )
}

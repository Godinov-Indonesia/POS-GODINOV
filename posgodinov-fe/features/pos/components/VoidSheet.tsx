'use client'

import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Select, Textarea } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import {
  isReasonComplete,
  OTHER_NOTES_MIN_LENGTH,
  OTHER_REASON,
  VOID_REASON_CODES,
  VOID_REASON_LABELS,
  type VoidReasonCode,
} from '@/lib/constants/cancellation'

/**
 * Formulir pembatalan — dipakai **ketiga** cakupan void ([11 §M13]).
 *
 * | Cakupan       | Dipicu dari                                  |
 * |---------------|----------------------------------------------|
 * | `CART_LINE`   | Stepper keranjang, penurunan qty > ambang    |
 * | `HELD_ORDER`  | Pembatalan pesanan tertahan                  |
 * | `TRANSACTION` | Layar Void (P-10)                            |
 *
 * Satu komponen untuk ketiganya bukan penghematan baris, melainkan penegakan:
 * aturan `OTHER` wajib bercatatan, kewajiban otoritas, dan peringatan bahwa
 * struk akan tercetak harus berbunyi sama di mana pun pembatalan terjadi. Tiga
 * formulir terpisah akan menyimpang, dan yang menyimpang adalah yang paling
 * jarang dilihat penguji.
 */
export type VoidSheetSubmit = {
  reasonCode: VoidReasonCode
  reasonNotes: string
}

type VoidSheetProps = {
  open: boolean
  title: string
  description: React.ReactNode
  /** sen — nilai yang akan lenyap. Ditampilkan agar keputusannya sadar nominal. */
  valueMinor: number
  /** `config.require_supervisor_for_void`. */
  requiresAuth: boolean
  onClose: () => void
  onSubmit: (result: VoidSheetSubmit) => void | Promise<void>
  submitLabel?: string
  busy?: boolean
}

export function VoidSheet(props: VoidSheetProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title}>
      {/*
        Formulirnya hanya di-*mount* saat terbuka, sehingga state-nya lahir
        bersih setiap kali — tanpa efek yang menulis state, yang justru memicu
        render berantai (`react-hooks/set-state-in-effect`).

        Kebersihan itu bukan kerapian: alasan pembatalan sebelumnya yang
        terbawa akan diterima apa adanya oleh kasir yang buru-buru, dan laporan
        kecurangan berisi alasan yang salah lebih buruk daripada tidak ada.
      */}
      {props.open ? <VoidForm {...props} /> : null}
    </Dialog>
  )
}

function VoidForm({
  description,
  valueMinor,
  requiresAuth,
  onClose,
  onSubmit,
  submitLabel = 'Batalkan',
  busy = false,
}: VoidSheetProps) {
  const [reasonCode, setReasonCode] = React.useState<VoidReasonCode | ''>('')
  const [notes, setNotes] = React.useState('')

  const complete = reasonCode !== '' && isReasonComplete(reasonCode, notes)

  return (
    <div className="flex flex-col gap-3">
        <Banner tone="warning" icon={AlertTriangle} title="Struk pembatalan akan tercetak">
          {/* Butir 6 — dinyatakan SEBELUM kasir menekan tombol, bukan sesudah. */}
          Setiap pembatalan menerbitkan struk pembatalan untuk audit. Simpan struk itu bersama
          laporan shift.
          {requiresAuth ? (
            <>
              {' '}
              <strong>Pembatalan ini memerlukan persetujuan supervisor.</strong>
            </>
          ) : null}
        </Banner>

        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-danger/30 bg-danger-subtle p-3">
          <span className="text-pos-sm text-fg-muted">Nilai yang dibatalkan</span>
          <Money minor={valueMinor} size="lg" />
        </div>

        <div className="text-pos-sm text-fg-muted">{description}</div>

        <Field label="Alasan pembatalan" htmlFor="void-reason" required>
          <Select
            id="void-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as VoidReasonCode | '')}
          >
            <option value="">— Pilih alasan —</option>
            {VOID_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {VOID_REASON_LABELS[code]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={reasonCode === OTHER_REASON ? 'Catatan (wajib)' : 'Catatan (opsional)'}
          htmlFor="void-notes"
          required={reasonCode === OTHER_REASON}
          hint={
            reasonCode === OTHER_REASON
              ? `Minimal ${OTHER_NOTES_MIN_LENGTH} karakter. Tanpa aturan ini seluruh kamus alasan runtuh menjadi "Lainnya".`
              : undefined
          }
        >
          <Textarea
            id="void-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: pelanggan mengurangi pesanan sebelum dibayar"
          />
        </Field>

        <div className="flex items-center gap-6">
          <Button variant="neutral" onClick={onClose} disabled={busy}>
            Tidak jadi
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={!complete || busy}
            onClick={() => {
              // `complete` sudah menjamin `reasonCode` tidak kosong; penyempitan
              // tipe TypeScript membuat pemeriksaan kedua mustahil bernilai true.
              if (!complete) return
              void onSubmit({ reasonCode: reasonCode as VoidReasonCode, reasonNotes: notes.trim() })
            }}
          >
            {busy ? 'Memproses…' : submitLabel}
          </Button>
        </div>
    </div>
  )
}

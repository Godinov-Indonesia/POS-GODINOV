'use client'

import { ArrowLeft, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { cartTotal } from '@/features/pos/cart/cart-math'
import { useCartStore } from '@/features/pos/cart/cart-store'
import { Keypad, digitsToMinor, useDigitInput } from '@/features/pos/components/Keypad'
import { commitPayment } from '@/features/pos/payment/commit-payment'
import {
  tenderedTotal,
  usePaymentDraftStore,
  type TenderDraft,
} from '@/features/pos/payment/payment-draft-store'
import { posNavigate, usePosParams } from '@/features/pos/router/usePosRouter'
import {
  digitsOnly,
  validateCardLast4,
  validateTraceNumber,
  TRACE_NUMBER_MAX_LENGTH,
} from '@/lib/constants/card-tender'
import {
  isCardMethod,
  PAYMENT_METHOD_LABELS,
  TENDER_METHODS,
  type PaymentMethod,
} from '@/lib/constants/payment'

/**
 * P-06b Pembayaran Kartu / Non-Tunai — **butir 8 & 11** ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRACE NUMBER DAN 4 DIGIT AKHIR — WAJIB, DAN DITEGAKKAN TIGA LAPIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tanpa keduanya, tender kartu tidak dapat dicocokkan dengan struk settlement
 * EDC saat Blind Closing ([11 §M15.3]). "EDC Rp 4.200.000" yang tidak dapat
 * dipecah menjadi transaksi mana saja adalah selisih yang tidak dapat
 * ditelusuri siapa pun — dan tidak dapat diperbaiki setelah harinya lewat.
 *
 * Validasinya hidup di `lib/constants/card-tender.ts` dan dipakai bersama oleh
 * layar ini serta `assertTenderIntegrity()`. Regex yang disalin ke dua tempat
 * akan berbeda pada perbaikan pertama.
 *
 * ⛔ **TIDAK ADA** kolom untuk nomor kartu penuh, CVV, PIN, maupun data
 * magstripe (aturan R8) — dan ketiadaannya bukan kelalaian. Menyimpannya
 * memindahkan seluruh sistem ke ruang lingkup PCI-DSS penuh.
 */
export function PaymentCardScreen() {
  const params = usePosParams()
  const lines = useCartStore((s) => s.lines)
  const tenders = usePaymentDraftStore((s) => s.tenders)
  const addTender = usePaymentDraftStore((s) => s.addTender)

  const total = cartTotal(lines)
  const alreadyTendered = tenderedTotal(tenders)
  const remaining = total - alreadyTendered

  // Metode datang dari parameter rute. Nilai yang tidak dikenal jatuh ke
  // `DEBIT` — bukan diloloskan apa adanya: `payment_method` adalah VARCHAR
  // bebas di server, dan satu nilai asing memecah pengelompokan laporan secara
  // permanen ([05 §3.3]).
  const method: PaymentMethod = (TENDER_METHODS as readonly string[]).includes(params.method ?? '')
    ? (params.method as PaymentMethod)
    : 'DEBIT'

  const requiresCard = isCardMethod(method)

  const [trace, setTrace] = React.useState('')
  const [last4, setLast4] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Nominal gesek default = SISA tagihan, bukan total. Pada split, sisa itulah
  // yang benar-benar akan digesek; menawarkan total membuat kasir menggesek
  // lebih besar daripada yang tersisa.
  const amountInput = useDigitInput(9)
  const swipeAmount =
    amountInput.digits.length > 0 ? digitsToMinor(amountInput.digits) : Math.max(0, remaining)

  const traceError = requiresCard && touched ? validateTraceNumber(trace) : null
  const last4Error = requiresCard && touched ? validateCardLast4(last4) : null

  const valid =
    swipeAmount > 0 &&
    swipeAmount <= remaining &&
    (!requiresCard || (!validateTraceNumber(trace) && !validateCardLast4(last4)))

  const buildTender = (): TenderDraft => ({
    method,
    amount: swipeAmount,
    ...(requiresCard ? { traceNumber: trace.trim(), cardLast4: last4 } : {}),
  })

  /** Menyelesaikan transaksi bila tender ini menutup seluruh sisa. */
  const submit = async () => {
    setTouched(true)
    if (!valid) return

    setSaving(true)
    try {
      const outcome = await commitPayment({ tenders: [...tenders, buildTender()] })
      if (!outcome.ok) toast.error(outcome.error)
    } finally {
      setSaving(false)
    }
  }

  /** Menyimpan tender ini lalu kembali ke penyusun split untuk sisanya. */
  const addAndContinue = () => {
    setTouched(true)
    if (!valid) return
    addTender(buildTender())
    posNavigate('payment-split')
  }

  const closesTotal = swipeAmount === remaining

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => posNavigate(tenders.length ? 'payment-split' : 'payment')}
          disabled={saving}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">{PAYMENT_METHOD_LABELS[method]}</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-pos-base text-fg-muted">Total transaksi</span>
          <Money minor={total} size="lg" />
        </div>
        {tenders.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-pos-base text-fg-muted">Sisa tagihan</span>
            <Money minor={remaining} size="xl" />
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-pos-base text-fg-muted">Nominal gesek</span>
          <Money minor={swipeAmount} size="2xl" />
        </div>
        {swipeAmount > remaining ? (
          <p role="alert" className="text-pos-sm text-danger">
            ⚠ Nominal gesek melebihi sisa tagihan.
          </p>
        ) : null}
      </div>

      {requiresCard ? (
        <>
          <Field
            label="Trace Number"
            htmlFor="card-trace"
            required
            hint="Tercetak pada struk EDC. Tanpa angka ini, tender kartu tidak dapat dicocokkan saat tutup shift."
            error={traceError ?? undefined}
          >
            <Input
              id="card-trace"
              inputMode="numeric"
              autoComplete="off"
              className="h-touch-md font-mono text-pos-md"
              maxLength={TRACE_NUMBER_MAX_LENGTH}
              value={trace}
              // Disaring saat DIKETIK, bukan saat submit. Sebagian pemindai
              // kartu mengirimkan karakter kontrol yang tidak terlihat di layar.
              onChange={(e) => setTrace(digitsOnly(e.target.value))}
              onBlur={() => setTouched(true)}
            />
          </Field>

          <Field
            label="4 Digit Akhir Kartu"
            htmlFor="card-last4"
            required
            hint="Empat angka terakhir pada kartu — bukan nomor kartu penuh."
            error={last4Error ?? undefined}
          >
            <Input
              id="card-last4"
              inputMode="numeric"
              autoComplete="off"
              className="h-touch-md w-32 text-center font-mono text-pos-lg tracking-widest"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(digitsOnly(e.target.value).slice(0, 4))}
              onBlur={() => setTouched(true)}
            />
          </Field>

          <Banner tone="info">
            <span className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Aplikasi ini <strong>tidak pernah</strong> menyimpan nomor kartu penuh, CVV, maupun
              PIN. Hanya trace number dan empat digit akhir — cukup untuk rekonsiliasi, tidak cukup
              untuk menyalahgunakan kartu.
            </span>
          </Banner>
        </>
      ) : (
        <Banner tone="info">
          {PAYMENT_METHOD_LABELS[method]} dicatat sebagai lunas sebesar nominal di atas. Sistem ini
          tidak terhubung ke payment gateway mana pun — konfirmasi dilakukan kasir secara manual.
        </Banner>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-pos-sm font-medium text-fg">
          Ubah nominal gesek (kosongkan untuk memakai sisa tagihan)
        </span>
        <div className="max-w-sm">
          <Keypad
            onDigit={amountInput.append}
            onClear={amountInput.clear}
            onBackspace={amountInput.backspace}
            disabled={saving}
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {/* Tombol "tambah tender" hanya muncul bila nominalnya TIDAK menutup
            sisa. Menawarkan keduanya sekaligus membuat kasir memilih antara dua
            tombol yang salah satunya pasti keliru. */}
        {!closesTotal && swipeAmount > 0 && swipeAmount < remaining ? (
          <Button variant="neutral" size="xl" block disabled={saving} onClick={addAndContinue}>
            Simpan tender & lanjut ke sisa tagihan
          </Button>
        ) : null}

        <Button
          variant="cash"
          size="cash"
          block
          disabled={saving || !valid || !closesTotal}
          onClick={submit}
        >
          {saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI'}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Undo2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Select, Textarea } from '@/components/ui/input'
import { Money, Num, shortId } from '@/components/ui/money'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posNavigate, usePosParams } from '@/features/pos/router/usePosRouter'
import {
  isReasonComplete,
  OTHER_NOTES_MIN_LENGTH,
  OTHER_REASON,
  REFUND_METHOD_LABELS,
  RETURN_REASON_CODES,
  RETURN_REASON_LABELS,
  WASTE_REASON_CODES,
  WASTE_REASON_LABELS,
  type ReturnReasonCode,
  type WasteReasonCode,
} from '@/lib/constants/cancellation'
import type { LocalReturnItem } from '@/lib/db/models'
import { returnedQuantities, saveReturn } from '@/lib/db/repositories/return.repo'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'
import { getTransaction } from '@/lib/db/repositories/transaction.repo'
import {
  decideCancellation,
  FORBIDDEN_MESSAGE,
  type ReturnableItem,
} from '@/lib/pos/cancellation/decide'
import { formatDateTimeId } from '@/lib/time'
import type { RefundMethod } from '@/lib/types/api'

/**
 * **P-15 Retur — layar baru pada Fase M13.3.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RETUR BUKAN "VOID YANG TERLAMBAT"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Transaksi asal **tidak disentuh sama sekali** oleh layar ini. Yang lahir
 * adalah baris `returns` baru dengan waktunya sendiri dan shift-nya sendiri —
 * yang boleh berbeda dari shift transaksi asal, karena pelanggan yang kembali
 * besok adalah kasus ritel normal ([11 §2.1]).
 *
 * Dua hal yang membuatnya mustahil direduksi menjadi transaksi bernilai negatif:
 *
 * 1. **Arah uang dan arah barang dapat berbeda.** Barang rusak: uang kembali ke
 *    pelanggan, stok TIDAK kembali. Itulah `restock`.
 * 2. **Batas per baris, bukan per transaksi.** Item yang sudah habis diretur
 *    tetap ditampilkan dengan sisa 0, supaya kasir tidak bertanya-tanya mengapa
 *    totalnya tidak cocok.
 *
 * Layar penuh, bukan modal — sejalan dengan arah butir 11.
 */
export function ReturnScreen() {
  const params = usePosParams()
  const transactionId = params.transactionId
  const staffId = usePosAuthStore((s) => s.staffId)
  const staffName = usePosAuthStore((s) => s.staffName)

  const context = useLiveQuery(async () => {
    if (!transactionId) return null
    const transaction = await getTransaction(transactionId)
    if (!transaction) return null
    const already = await returnedQuantities(transactionId)
    return { transaction, decision: decideCancellation(transaction, already) }
  }, [transactionId], undefined)

  /** `transaction_item_id → qty yang dipilih untuk diretur`. */
  const [picked, setPicked] = React.useState<Record<string, number>>({})
  /** `transaction_item_id → apakah barangnya kembali ke stok`. */
  const [restock, setRestock] = React.useState<Record<string, boolean>>({})
  /** `transaction_item_id → alasan pembuangan` (wajib bila `restock = false`). */
  const [wasteReason, setWasteReason] = React.useState<Record<string, WasteReasonCode>>({})

  const [refundMethod, setRefundMethod] = React.useState<RefundMethod>('CASH')
  const [reasonCode, setReasonCode] = React.useState<ReturnReasonCode | ''>('')
  const [notes, setNotes] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  if (context === undefined) {
    return <div className="p-4 text-pos-sm text-fg-muted">Memuat transaksi…</div>
  }

  if (context === null) {
    return (
      <Shell>
        <EmptyState
          icon={AlertTriangle}
          title="Transaksi tidak ditemukan"
          description="Transaksi mungkin berasal dari perangkat lain. Cari lewat Kode Struk di layar Riwayat."
        />
      </Shell>
    )
  }

  const { transaction, decision } = context

  if (decision.kind === 'FORBIDDEN') {
    return (
      <Shell>
        <EmptyState icon={AlertTriangle} title="Retur tidak dapat diproses"
          description={FORBIDDEN_MESSAGE[decision.reason]} />
      </Shell>
    )
  }

  if (decision.kind === 'VOID') {
    // Struknya belum tercetak — jalurnya Void, bukan Retur. Layar ini menolak
    // memprosesnya alih-alih diam-diam membuat retur yang tidak sah.
    return (
      <Shell>
        <EmptyState
          icon={AlertTriangle}
          title="Transaksi ini belum tercetak"
          description="Struknya belum pernah terbit, sehingga jalurnya adalah Pembatalan (Void), bukan Retur."
        />
        <Button variant="danger" onClick={() => posNavigate('void')}>
          Buka Layar Pembatalan
        </Button>
      </Shell>
    )
  }

  const items = decision.returnableItems
  const selectedTotal = items.reduce(
    (sum, item) => sum + (picked[item.transaction_item_id] ?? 0) * item.unit_price,
    0,
  )
  const selectedCount = items.reduce(
    (sum, item) => sum + (picked[item.transaction_item_id] ?? 0),
    0,
  )

  /** Setiap item yang tidak kembali ke stok WAJIB punya alasan pembuangan. */
  const missingWasteReason = items.some((item) => {
    const qty = picked[item.transaction_item_id] ?? 0
    if (qty === 0) return false
    if (restock[item.transaction_item_id] !== false) return false
    return !wasteReason[item.transaction_item_id]
  })

  const canSubmit =
    selectedCount > 0 &&
    reasonCode !== '' &&
    isReasonComplete(reasonCode, notes) &&
    !missingWasteReason &&
    !busy

  const setQty = (item: ReturnableItem, next: number) => {
    // Penjepitan pada `returnable`, BUKAN pada kuantitas asli. Inilah batas
    // yang mencegah barang yang sama diretur dua kali lewat dua perangkat.
    const clamped = Math.max(0, Math.min(item.returnable, next))
    setPicked((prev) => ({ ...prev, [item.transaction_item_id]: clamped }))
  }

  const submit = async () => {
    // `canSubmit` sudah menjamin `reasonCode` terisi; penyempitan tipe
    // TypeScript membuat pemeriksaan kedua mustahil bernilai true.
    if (!canSubmit || !staffId) return

    setBusy(true)
    try {
      const shift = await getOpenShift()
      if (!shift) {
        toast.error('Tidak ada shift aktif — retur harus terikat pada satu shift.')
        return
      }

      // Diputuskan ULANG tepat sebelum menulis: sebuah retur dari perangkat
      // lain bisa saja tersinkron sejak layar ini dibuka.
      const fresh = decideCancellation(transaction, await returnedQuantities(transaction.id))
      if (fresh.kind !== 'RETURN') {
        toast.error('Kondisi transaksi berubah sejak layar ini dibuka. Muat ulang.')
        return
      }

      const freshById = new Map(fresh.returnableItems.map((i) => [i.transaction_item_id, i]))
      const payload: Omit<LocalReturnItem, 'id'>[] = []

      for (const item of items) {
        const qty = picked[item.transaction_item_id] ?? 0
        if (qty === 0) continue

        const limit = freshById.get(item.transaction_item_id)?.returnable ?? 0
        if (qty > limit) {
          toast.error(
            `Sisa yang boleh diretur untuk ${item.product_name} berubah menjadi ${limit}.`,
          )
          return
        }

        const keepsStock = restock[item.transaction_item_id] !== false
        payload.push({
          transaction_item_id: item.transaction_item_id,
          product_id: item.product_id,
          quantity: qty,
          unit_price: item.unit_price,
          restock: keepsStock,
          waste_reason_code: keepsStock ? null : wasteReason[item.transaction_item_id],
          _product_name: item.product_name,
        })
      }

      await saveReturn({
        originalTransactionId: transaction.id,
        shiftId: shift.id,
        staffId,
        refundMethod,
        reasonCode: reasonCode as ReturnReasonCode,
        reasonNotes: notes.trim(),
        items: payload,
        originalQuantities: Object.fromEntries(
          items.map((i) => [i.transaction_item_id, i.original_quantity]),
        ),
        originalCode: transaction.short_code ?? transaction.id,
        cashierName: staffName ?? undefined,
        refundMethodLabel: REFUND_METHOD_LABELS[refundMethod],
      })

      toast.success('Retur tersimpan. Struk retur sedang dicetak.')
      posNavigate('history')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3">
        <Num className="text-pos-base font-semibold">
          {transaction.short_code ?? shortId(transaction.id)}
        </Num>
        <span className="text-pos-xs text-fg-muted">
          {formatDateTimeId(transaction.client_created_at)} · Total{' '}
          <Money minor={transaction.total_amount} size="sm" />
        </span>
      </div>

      <Banner tone="warning" title="Transaksi asal tidak diubah">
        Retur menerbitkan catatan <strong>baru</strong>; transaksi aslinya tetap tercatat sebagaimana
        adanya. Itulah yang membuat struk di tangan pelanggan tetap cocok dengan pembukuan.
      </Banner>

      <h2 className="text-pos-base font-semibold text-fg">Item yang diretur</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const qty = picked[item.transaction_item_id] ?? 0
          const keepsStock = restock[item.transaction_item_id] !== false
          const exhausted = item.returnable === 0

          return (
            <li
              key={item.transaction_item_id}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${
                exhausted ? 'border-border bg-bg-muted opacity-60' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-pos-base font-medium text-fg">{item.product_name}</span>
                  <span className="text-pos-xs text-fg-muted">
                    Dibeli <Num>{item.original_quantity}</Num>
                    {item.already_returned > 0 ? (
                      <>
                        {' '}
                        · sudah diretur <Num>{item.already_returned}</Num>
                      </>
                    ) : null}{' '}
                    · sisa <Num>{item.returnable}</Num>
                  </span>
                </div>
                <Money minor={item.unit_price} size="sm" tone="muted" />
              </div>

              {exhausted ? (
                <Badge tone="neutral">Sudah diretur seluruhnya</Badge>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="neutral"
                      size="icon"
                      className="h-12 w-12"
                      aria-label={`Kurangi retur ${item.product_name}`}
                      onClick={() => setQty(item, qty - 1)}
                    >
                      −
                    </Button>
                    <Num className="w-10 text-center text-pos-lg font-bold">{qty}</Num>
                    <Button
                      variant="neutral"
                      size="icon"
                      className="h-12 w-12"
                      aria-label={`Tambah retur ${item.product_name}`}
                      onClick={() => setQty(item, qty + 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setQty(item, item.returnable)}
                    >
                      Semua ({item.returnable})
                    </Button>
                  </div>

                  {qty > 0 ? (
                    <div className="flex flex-col gap-2 rounded-lg bg-bg-muted p-2">
                      <label className="flex items-center gap-2 text-pos-sm">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={keepsStock}
                          onChange={(e) =>
                            setRestock((prev) => ({
                              ...prev,
                              [item.transaction_item_id]: e.target.checked,
                            }))
                          }
                        />
                        Barang kembali ke stok
                      </label>

                      {!keepsStock ? (
                        <Field
                          label="Alasan pembuangan"
                          htmlFor={`waste-${item.transaction_item_id}`}
                          required
                          hint="Tanpa alasan ini, selisih stok muncul saat opname tanpa penjelasan — dan tertuduhnya adalah petugas gudang."
                        >
                          <Select
                            id={`waste-${item.transaction_item_id}`}
                            value={wasteReason[item.transaction_item_id] ?? ''}
                            onChange={(e) =>
                              setWasteReason((prev) => ({
                                ...prev,
                                [item.transaction_item_id]: e.target.value as WasteReasonCode,
                              }))
                            }
                          >
                            <option value="">— Pilih alasan —</option>
                            {WASTE_REASON_CODES.map((code) => (
                              <option key={code} value={code}>
                                {WASTE_REASON_LABELS[code]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </li>
          )
        })}
      </ul>

      <Field label="Metode pengembalian" htmlFor="refund-method" required>
        <Select
          id="refund-method"
          value={refundMethod}
          onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
        >
          <option value="CASH">Tunai</option>
          <option value="CARD_REVERSAL">Pembatalan Kartu</option>
          <option value="QRIS_REVERSAL">Pembatalan QRIS</option>
          <option value="EXCHANGE">Tukar Barang (tanpa uang keluar)</option>
          <option value="STORE_CREDIT">Kredit Toko</option>
        </Select>
      </Field>

      <Field label="Alasan retur" htmlFor="return-reason" required>
        <Select
          id="return-reason"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode | '')}
        >
          <option value="">— Pilih alasan —</option>
          {RETURN_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {RETURN_REASON_LABELS[code]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={reasonCode === OTHER_REASON ? 'Catatan (wajib)' : 'Catatan (opsional)'}
        htmlFor="return-notes"
        required={reasonCode === OTHER_REASON}
        hint={
          reasonCode === OTHER_REASON
            ? `Minimal ${OTHER_NOTES_MIN_LENGTH} karakter.`
            : undefined
        }
      >
        <Textarea
          id="return-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contoh: kemasan bocor saat diterima pelanggan"
        />
      </Field>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-surface p-3">
        <div className="flex flex-col">
          <span className="text-pos-xs text-fg-muted">
            <Num>{selectedCount}</Num> item dikembalikan
          </span>
          <Money minor={selectedTotal} size="xl" />
        </div>
        <Button
          variant="danger"
          size="xl"
          className="ml-auto flex-1"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          <Undo2 className="size-5" aria-hidden="true" />
          {busy ? 'MEMPROSES…' : 'PROSES RETUR'}
        </Button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('history')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Retur Penjualan</h1>
      </div>
      {children}
    </div>
  )
}

'use client'

import { create } from 'zustand'

import type { LocalPayment } from '@/lib/db/models'
import type { PaymentMethod } from '@/lib/constants/payment'

/**
 * Draf tender yang sedang disusun kasir — **butir 8 & 11** ([11 §M17.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA STATE INI HIDUP DI LUAR KOMPONEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sub-langkah pembayaran kini adalah RUTE tersendiri (`payment-card`,
 * `payment-split`, …). Rute berarti komponennya dilepas dan dipasang ulang saat
 * kasir berpindah langkah — dan state yang tinggal di `useState` komponen ikut
 * lenyap bersamanya.
 *
 * Tender yang sudah dimasukkan pada pembayaran split TIDAK BOLEH hilang ketika
 * kasir menekan back untuk mengoreksi satu angka. Store ini yang membuatnya
 * bertahan.
 *
 * ⚠️ Hidup **hanya di memori**, tidak pernah menyentuh Dexie. Draf tender bukan
 * data yang perlu selamat dari penutupan aplikasi: uang belum berpindah, dan
 * memulihkan setengah pembayaran setelah aplikasi dibuka kembali jauh lebih
 * membingungkan daripada memulai ulang.
 */
export type TenderDraft = {
  method: PaymentMethod
  /** sen — nominal gesek untuk kartu, bukan total transaksi. */
  amount: number
  traceNumber?: string
  cardLast4?: string
}

type PaymentDraftState = {
  tenders: TenderDraft[]
  addTender: (tender: TenderDraft) => void
  removeTender: (index: number) => void
  reset: () => void
}

export const usePaymentDraftStore = create<PaymentDraftState>((set) => ({
  tenders: [],
  addTender: (tender) => set((s) => ({ tenders: [...s.tenders, tender] })),
  removeTender: (index) =>
    set((s) => ({ tenders: s.tenders.filter((_, i) => i !== index) })),
  reset: () => set({ tenders: [] }),
}))

/** Total yang sudah tertutup oleh tender yang dimasukkan. */
export const tenderedTotal = (tenders: TenderDraft[]): number =>
  tenders.reduce((sum, t) => sum + t.amount, 0)

/**
 * Mengubah draf menjadi baris `LocalPayment` siap simpan.
 *
 * `sequence` dimulai dari **1**, bukan 0 — cerminan langsung kolom
 * `transaction_payments.sequence` di PostgreSQL ([11 §3.2]). Ketidakcocokan
 * satu angka di sini hanya terlihat saat rekonsiliasi EDC berbulan-bulan
 * kemudian.
 */
export const toLocalPayments = (
  tenders: TenderDraft[],
  newId: () => string,
): LocalPayment[] =>
  tenders.map((t, index) => ({
    id: newId(),
    sequence: index + 1,
    method: t.method,
    amount: t.amount,
    trace_number: t.traceNumber ?? null,
    card_last4: t.cardLast4 ?? null,
  }))

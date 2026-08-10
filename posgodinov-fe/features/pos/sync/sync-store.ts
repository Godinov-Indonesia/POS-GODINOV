'use client'

import { create } from 'zustand'

import type { SyncTrigger } from '@/lib/db/models'

/**
 * Status mesin sinkronisasi — docs/05 §1.6.
 *
 * Hanya menyimpan **status tampilan**. Antreannya sendiri ada di Dexie
 * (`_synced = 0`), bukan di sini — store yang hilang saat reload tidak boleh
 * menjadi tempat data keuangan menunggu.
 */
export type SyncSkipReason = 'locked' | 'backoff' | 'offline' | 'empty' | null

type SyncState = {
  syncing: boolean
  lastTrigger: SyncTrigger | null
  lastSuccessAt: string | null
  lastError: string | null
  lastSkipped: SyncSkipReason
  /** Selisih jam perangkat terhadap server, ms. `null` = belum pernah diukur. */
  clockSkewMs: number | null
  /** `true` bila selisihnya melewati ambang peringatan ([05 §1.8.2]). */
  clockWarning: boolean

  setSyncing: (syncing: boolean, trigger?: SyncTrigger) => void
  setSuccess: (at: string) => void
  setError: (message: string) => void
  setSkipped: (reason: SyncSkipReason) => void
  setClockSkew: (skewMs: number, significant: boolean) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastTrigger: null,
  lastSuccessAt: null,
  lastError: null,
  lastSkipped: null,
  clockSkewMs: null,
  clockWarning: false,

  setSyncing: (syncing, trigger) =>
    set((s) => ({ syncing, lastTrigger: trigger ?? s.lastTrigger })),
  setSuccess: (at) => set({ lastSuccessAt: at, lastError: null, lastSkipped: null }),
  setError: (message) => set({ lastError: message }),
  setSkipped: (reason) => set({ lastSkipped: reason }),
  setClockSkew: (skewMs, significant) => set({ clockSkewMs: skewMs, clockWarning: significant }),
}))

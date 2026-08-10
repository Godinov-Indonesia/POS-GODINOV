'use client'

import { create } from 'zustand'

/**
 * Identitas kasir — docs/05 §1.4.5.
 *
 * Lapis kedua setelah `device_token`. Hidup **hanya di memori**: menutup tab
 * berarti kasir harus memasukkan PIN lagi, yang justru diinginkan pada
 * perangkat bersama di konter.
 */
type PosAuthState = {
  staffId: string | null
  staffName: string | null
  login: (staff: { id: string; name: string }) => void
  logout: () => void
}

export const usePosAuthStore = create<PosAuthState>((set) => ({
  staffId: null,
  staffName: null,
  login: (staff) => set({ staffId: staff.id, staffName: staff.name }),
  logout: () => set({ staffId: null, staffName: null }),
}))

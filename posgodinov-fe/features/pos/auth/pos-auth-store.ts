'use client'

import { create } from 'zustand'

import { recordPosSecurityEvent } from '@/features/pos/security/record-event'
import { SECURITY_EVENT } from '@/lib/constants/security-events'
import { getOpenShift } from '@/lib/db/repositories/shift.repo'

/**
 * Identitas kasir — docs/05 §1.4.5, dikunci pada Fase M15.2 (**butir 12**).
 *
 * Lapis kedua setelah `device_token`. Hidup **hanya di memori**: menutup tab
 * berarti kasir harus memasukkan PIN lagi, yang justru diinginkan pada
 * perangkat bersama di konter.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA `logout` TIDAK LAGI ADA DI SINI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Selama ada shift `OPEN`, keluar dari sesi berarti meninggalkan laci terbuka
 * atas nama orang yang sudah tidak ada di tempat. Transaksi berikutnya tercatat
 * pada shift kasir sebelumnya, dan selisih kas yang lahir darinya dituntut dari
 * orang yang tidak melakukannya.
 *
 * Store ini karena itu hanya mengekspos **dua** jalan keluar, dan keduanya
 * bernama jujur:
 *
 *   `requestLogout()`  — dapat DITOLAK, dan penolakannya tercatat
 *   `clearSession()`   — tanpa syarat, HANYA untuk saga tutup shift & force close
 *
 * `clearSession` sengaja tidak dinamai `logout`: nama yang netral akan dipanggil
 * dari tombol mana pun oleh orang yang tidak tahu mengapa gerbangnya ada.
 */
type PosAuthState = {
  staffId: string | null
  staffName: string | null
  login: (staff: { id: string; name: string }) => void

  /**
   * Menghapus sesi **tanpa memeriksa apa pun**.
   *
   * ⛔ Hanya BOLEH dipanggil dari:
   *   1. `closeShiftSaga` — setelah shift benar-benar tertulis `CLOSED`
   *   2. Force Close Shift oleh supervisor — setelah PIN diverifikasi
   *
   * Pemanggil ketiga mana pun adalah bug butir 12.
   */
  clearSession: () => void
}

export const usePosAuthStore = create<PosAuthState>((set) => ({
  staffId: null,
  staffName: null,
  login: (staff) => set({ staffId: staff.id, staffName: staff.name }),
  clearSession: () => set({ staffId: null, staffName: null }),
}))

/** Hasil percobaan keluar sesi. */
export type LogoutVerdict =
  | { ok: true }
  | { ok: false; reason: 'active-shift'; shiftId: string }

/**
 * Satu-satunya jalan keluar sesi yang boleh dipanggil UI.
 *
 * Memeriksa shift **dari Dexie**, bukan dari state React. Percobaan keluar
 * tidak selalu datang dari tombol: tombol back berulang, deep link `#login`,
 * dan `usePosAuthStore.getState()` lewat konsol semuanya melewati fungsi ini,
 * dan tidak satu pun dari ketiganya berada di dalam pohon komponen.
 *
 * Penolakannya **dicatat**, bukan sekadar dikembalikan. Kasir yang berulang
 * kali mencoba keluar dengan laci terbuka adalah pola yang layak dilihat
 * pemilik — dan bila perangkat sedang offline, catatan itu ikut antrean sync
 * (aturan R9).
 */
export async function requestLogout(source: string): Promise<LogoutVerdict> {
  const shift = await getOpenShift()

  if (shift) {
    await recordPosSecurityEvent({
      eventType: SECURITY_EVENT.LOGOUT_BLOCKED_ACTIVE_SHIFT,
      details: { source, shift_id: shift.id },
    })
    return { ok: false, reason: 'active-shift', shiftId: shift.id }
  }

  usePosAuthStore.getState().clearSession()
  return { ok: true }
}

/**
 * Apakah sesi sedang terkunci oleh shift berjalan.
 *
 * Dipakai UI untuk **menghapus tombol dari render**, bukan menonaktifkannya.
 * Tombol yang tampak tetapi ditolak mengajari kasir bahwa aplikasinya rusak;
 * tombol yang tidak ada tidak mengajari apa pun.
 */
export const isSessionLocked = async (): Promise<boolean> => !!(await getOpenShift())

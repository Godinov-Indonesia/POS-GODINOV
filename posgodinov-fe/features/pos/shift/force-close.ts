'use client'

/**
 * Force Close Shift — jalur darurat butir 12 ([11 §M15.2]).
 *
 * Dipisah dari komponennya supaya aturan yang mengikatnya — alasan wajib,
 * peristiwa CRITICAL, pembersihan sesi — dapat diuji tanpa merender apa pun,
 * dan supaya tidak ada layar kedua yang menyusun langkahnya sendiri.
 */

import { useCartStore } from '@/features/pos/cart/cart-store'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posReplace } from '@/features/pos/router/usePosRouter'
import { recordPosSecurityEvent } from '@/features/pos/security/record-event'
import { runSync } from '@/features/pos/sync/useSyncEngine'
import { SECURITY_EVENT } from '@/lib/constants/security-events'
import { closeShift, getOpenShift } from '@/lib/db/repositories/shift.repo'

/** Panjang minimum alasan. Sama dengan ambang `OTHER` pada kamus reason code. */
export const FORCE_CLOSE_MIN_REASON = 10

export type ForceCloseOutcome = { ok: true; shiftId: string } | { ok: false; error: string }

/**
 * Menutup paksa shift yang sedang berjalan atas otoritas supervisor.
 *
 * ⚠️ Pemanggil WAJIB sudah memverifikasi PIN lewat `verifySupervisor`. Fungsi
 * ini tidak memverifikasi apa pun tentang identitas — memindahkan verifikasi ke
 * sini akan membuatnya berjalan dua kali pada satu-satunya pemanggil yang ada,
 * dan memisahkannya membuat jelas siapa yang bertanggung jawab atas apa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEKLARASI NOL, DAN `blind_close: false`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tidak ada yang menghitung laci saat Force Close. Menuliskan angka apa pun
 * selain nol berarti mengarang kesaksian atas nama orang yang tidak ada di
 * tempat, dan `ShiftReconcileService` akan menghitung selisih terhadap angka
 * karangan itu.
 *
 * `blind_close: false` adalah penandanya: shift ini **bukan** hasil penutupan
 * buta yang sah, dan laporan pemilik dapat memisahkannya dari shift yang
 * angkanya benar-benar berasal dari hitungan seseorang.
 */
export async function forceCloseShift(params: {
  supervisorId: string
  supervisorName: string
  reason: string
}): Promise<ForceCloseOutcome> {
  const reason = params.reason.trim()
  if (reason.length < FORCE_CLOSE_MIN_REASON) {
    return { ok: false, error: `Alasan minimal ${FORCE_CLOSE_MIN_REASON} karakter.` }
  }

  const shift = await getOpenShift()
  if (!shift) return { ok: false, error: 'Tidak ada shift terbuka untuk ditutup.' }

  // ── Peristiwa DULU, penutupan KEMUDIAN ──────────────────────────────────
  //
  // Urutan ini disengaja dan berbeda dari saga tutup shift biasa. Bila
  // penulisan shift berhasil tetapi pencatatan peristiwanya gagal, yang tersisa
  // adalah shift tertutup tanpa satu pun jejak siapa yang memaksanya — persis
  // penyalahgunaan yang jalur ini harus buat mustahil.
  //
  // Sebaliknya, peristiwa yang tercatat untuk penutupan yang kemudian gagal
  // hanya menghasilkan satu baris audit berlebih, dan itu keliru ke arah yang
  // benar.
  await recordPosSecurityEvent({
    eventType: SECURITY_EVENT.SHIFT_FORCE_CLOSED,
    severity: 'CRITICAL',
    details: {
      shift_id: shift.id,
      // Kasir pemilik shift, BUKAN yang menutupnya. Keduanya dicatat justru
      // karena perbedaannya yang menjadi inti peristiwa ini.
      shift_staff_id: shift.staff_id,
      supervisor_id: params.supervisorId,
      supervisor_name: params.supervisorName,
      reason,
      opened_at: shift.client_opened_at,
    },
  })

  try {
    await closeShift({
      shiftId: shift.id,
      declaredCashMinor: 0,
      declaredEdcMinor: 0,
      declaredQrisMinor: 0,
      blindClose: false,
      closedBy: params.supervisorId,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal menutup paksa shift.',
    }
  }

  void runSync('shift-close')

  // Sesi kasir lama ikut dibersihkan: perangkat baru saja dilepas dari shift
  // orang lain, dan meninggalkan namanya di StatusBar akan membuat kasir
  // berikutnya berjualan atas identitas yang salah.
  try {
    useCartStore.getState().clear()
  } catch {
    // Store yang gagal dibersihkan tidak boleh menahan perangkat tetap terkunci.
  }
  usePosAuthStore.getState().clearSession()
  // `replace`, dengan alasan yang sama seperti pada saga tutup shift: layar
  // Pengaturan milik shift yang baru saja ditutup paksa tidak boleh dapat
  // dicapai lagi lewat *Back*.
  posReplace('login', { closed: 'force' })

  return { ok: true, shiftId: shift.id }
}

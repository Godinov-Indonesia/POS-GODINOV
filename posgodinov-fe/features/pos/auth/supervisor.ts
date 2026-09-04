'use client'

/**
 * Otorisasi supervisor — dipakai Force Close Shift ([11 §M15.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DIPUTUSKAN OFFLINE, DAN ITU KEHARUSAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Peran dan izin ikut turun bersama master data ([11 §4.4]) justru supaya
 * keputusan ini tidak memerlukan jaringan. Force Close dibutuhkan tepat ketika
 * ada yang tidak beres — kasir pulang tanpa menutup shift, perangkat terkunci
 * pagi berikutnya — dan keadaan semacam itu tidak menunggu sinyal membaik.
 *
 * Verifikasi PIN memakai bcrypt di Web Worker yang sama dengan login kasir
 * (ADR-08), sehingga tidak ada jalur perbandingan PIN kedua yang harus dijaga
 * benar secara terpisah.
 */

import { verifyPin } from '@/features/pos/auth/pin-verifier'
import { findStaffByIdentifier } from '@/lib/db/repositories/master.repo'
import type { LocalStaff } from '@/lib/db/models'

/**
 * Peran yang berwenang melakukan Force Close.
 *
 * Kasir sengaja TIDAK ada di daftar ini. Jalur darurat yang dapat dipakai
 * pemiliknya sendiri bukan jalur darurat — ia hanya tombol "tutup paksa" yang
 * kebetulan bernama lain, dan seluruh Blind Closing dapat dilewati dengannya.
 */
const FORCE_CLOSE_ROLES: ReadonlySet<string> = new Set(['OWNER', 'SUPERVISOR', 'ADMIN'])

/** Izin granular yang setara, bila pemilik memakai peran khusus. */
const FORCE_CLOSE_PERMISSION = 'SHIFT_FORCE_CLOSE'

export type SupervisorVerdict =
  | { ok: true; staff: LocalStaff }
  | { ok: false; reason: 'not-found' | 'wrong-pin' | 'not-authorized' }

/**
 * Memverifikasi identitas dan kewenangan seorang supervisor.
 *
 * Urutannya disengaja: PIN diperiksa **sebelum** kewenangan. Membalikkannya
 * akan membocorkan peran seseorang kepada siapa pun yang mengetahui ID-nya —
 * "PIN salah" versus "bukan supervisor" adalah dua jawaban yang berbeda, dan
 * perbedaannya cukup untuk memetakan siapa yang berwenang di outlet ini.
 */
export async function verifySupervisor(
  identifier: string,
  pin: string,
): Promise<SupervisorVerdict> {
  const staff = await findStaffByIdentifier(identifier)

  // Pesan yang sama untuk ID tidak ada dan PIN salah — pola yang sama dengan
  // layar login kasir, dan alasannya sama: layar ini terpasang di area publik.
  if (!staff) return { ok: false, reason: 'not-found' }
  if (!(await verifyPin(pin, staff.pin_hash))) return { ok: false, reason: 'wrong-pin' }

  if (!canForceClose(staff)) return { ok: false, reason: 'not-authorized' }

  return { ok: true, staff }
}

/**
 * Apakah [staff] berwenang menutup paksa shift.
 *
 * Perangkat yang master datanya berasal dari server pra-v2 tidak memiliki
 * `role` sama sekali. Kasus itu ditolak, bukan diloloskan: jalur darurat yang
 * terbuka untuk semua orang pada perangkat yang kebetulan belum diperbarui
 * adalah pintu belakang, bukan kompatibilitas.
 */
export function canForceClose(staff: LocalStaff): boolean {
  if (staff.role && FORCE_CLOSE_ROLES.has(staff.role.toUpperCase())) return true
  return (staff.permissions ?? []).includes(FORCE_CLOSE_PERMISSION)
}

export const SUPERVISOR_MESSAGE: Record<
  Exclude<SupervisorVerdict, { ok: true }>['reason'],
  string
> = {
  'not-found': 'ID atau PIN salah.',
  'wrong-pin': 'ID atau PIN salah.',
  'not-authorized': 'Akun ini tidak berwenang menutup paksa shift.',
}

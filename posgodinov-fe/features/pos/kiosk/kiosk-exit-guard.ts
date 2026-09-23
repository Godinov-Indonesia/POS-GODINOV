'use client'

/**
 * Gerbang keluar mode Kiosk — **butir 14** ([11 §M17.4]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IZIN, BUKAN SEKADAR PIN YANG SAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Versi sebelumnya menerima PIN staff **mana pun** di outlet. Itu berarti
 * kasir yang perangkatnya dikunci dapat membukanya sendiri — dan mode Kiosk
 * yang dapat dibuka oleh orang yang seharusnya dikunci di dalamnya bukan mode
 * Kiosk, melainkan tombol yang kebetulan tersembunyi.
 *
 * Yang berubah: PIN harus milik staff yang izinnya memuat
 * `config.kiosk_exit_permission`. Diputuskan OFFLINE dari `permissions` yang
 * ikut master data ([11 §4.4]) — Kiosk justru dipakai di perangkat yang
 * jaringannya sengaja dibatasi.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA KEGAGALAN → JEDA 60 DETIK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Jeda ini bukan pengamanan kriptografis — ia melawan penebakan PIN 4 digit
 * secara beruntun. Sepuluh ribu kemungkinan pada tiga percobaan per menit
 * memakan lebih dari dua hari; tanpa jeda, memakan beberapa jam.
 *
 * Penghitungnya di MEMORI dan hilang saat aplikasi ditutup. Itu batas yang
 * nyata dan dinyatakan apa adanya: pada perangkat yang benar-benar terkunci
 * Device Owner, menutup aplikasi bukan pilihan yang tersedia — dan di situlah
 * jeda ini berlaku sepenuhnya.
 */

import { verifyPin } from '@/features/pos/auth/pin-verifier'
import { recordPosSecurityEvent } from '@/features/pos/security/record-event'
import { SECURITY_EVENT } from '@/lib/constants/security-events'
import { listStaffs } from '@/lib/db/repositories/master.repo'
import type { LocalStaff } from '@/lib/db/models'
import { readPosConfig } from '@/lib/pos/config'

/** Kegagalan berturut sebelum jeda dijatuhkan. */
export const MAX_EXIT_ATTEMPTS = 3

/** Lama jeda setelah [MAX_EXIT_ATTEMPTS] kegagalan. */
export const LOCKOUT_MS = 60_000

export type ExitVerdict =
  | { ok: true; staff: LocalStaff }
  | { ok: false; reason: 'bad-pin'; attemptsLeft: number }
  | { ok: false; reason: 'not-authorized'; attemptsLeft: number }
  | { ok: false; reason: 'locked-out'; retryAfterMs: number }

/**
 * Keadaan jeda, di tingkat modul.
 *
 * Bukan `useState`: dialog PIN dilepas dan dipasang ulang setiap kali ditutup,
 * dan penghitung yang ikut lahir bersamanya berarti jeda dapat dilewati hanya
 * dengan menutup lalu membuka dialognya kembali.
 */
let consecutiveFailures = 0
let lockedUntil = 0

/** Sisa jeda dalam milidetik; `0` berarti tidak sedang terkunci. */
export function lockoutRemainingMs(now = Date.now()): number {
  return Math.max(0, lockedUntil - now)
}

/**
 * Memverifikasi PIN keluar Kiosk.
 *
 * ⚠️ Identifier **tidak** diminta, berbeda dari login kasir. Layar Kiosk
 * menghadap pelanggan; menampilkan kolom ID staff berarti membocorkan daftar
 * siapa saja yang bekerja di outlet ini kepada siapa pun yang lewat.
 *
 * Konsekuensinya, PIN dicocokkan terhadap SELURUH staff berizin. Biayanya
 * nyata — bcrypt sekali per staff, 100–300 ms masing-masing — dan kelambatan
 * itu justru menyulitkan penebakan beruntun.
 *
 * Perulangan **tidak** dihentikan lebih awal saat cocok: keluar pada staff
 * pertama membuat PIN miliknya terverifikasi jauh lebih cepat daripada staff
 * terakhir, dan selisih itu dapat diukur.
 */
export async function verifyKioskExit(pin: string): Promise<ExitVerdict> {
  const now = Date.now()
  const remaining = lockoutRemainingMs(now)
  if (remaining > 0) return { ok: false, reason: 'locked-out', retryAfterMs: remaining }

  const config = await readPosConfig()
  const staffs = await listStaffs()

  // Dipisah SEBELUM verifikasi, bukan sesudah.
  //
  // Mencocokkan PIN terhadap seluruh staff lalu memeriksa izinnya akan
  // memberi tahu — lewat selisih waktu — bahwa PIN yang dimasukkan benar
  // tetapi orangnya tidak berwenang. Membatasi kandidat sejak awal membuat
  // kedua kegagalan tidak dapat dibedakan.
  const authorized = staffs.filter((s) =>
    (s.permissions ?? []).includes(config.kioskExitPermission),
  )

  let matched: LocalStaff | null = null
  for (const staff of authorized) {
    // Sengaja TIDAK `break` saat cocok — lihat catatan di atas.
    if (await verifyPin(pin, staff.pin_hash)) matched = staff
  }

  if (matched) {
    consecutiveFailures = 0
    await recordPosSecurityEvent({
      eventType: SECURITY_EVENT.KIOSK_EXIT_GRANTED,
      severity: 'WARN',
      details: { staff_id: matched.id, staff_name: matched.name },
    })
    return { ok: true, staff: matched }
  }

  consecutiveFailures += 1
  const attemptsLeft = Math.max(0, MAX_EXIT_ATTEMPTS - consecutiveFailures)

  // Apakah PIN-nya milik staff yang TIDAK berwenang?
  //
  // Diperiksa hanya untuk memilih JENIS peristiwa yang dicatat — pesannya ke
  // kasir tetap sama. Pemilik perlu dapat membedakan "orang asing menebak PIN"
  // dari "kasir sendiri mencoba membuka kuncinya"; keduanya menuntut tindakan
  // yang sangat berbeda.
  const unauthorizedHolder = await matchesUnauthorizedStaff(pin, staffs, authorized)

  await recordPosSecurityEvent({
    eventType: SECURITY_EVENT.KIOSK_EXIT_DENIED,
    // CRITICAL, bukan WARN — sesuai [11 §M17.4]. Percobaan membuka kunci
    // perangkat adalah peristiwa yang pemilik harus lihat, bukan sekadar
    // dicatat.
    severity: 'CRITICAL',
    details: {
      attempts: consecutiveFailures,
      attempts_left: attemptsLeft,
      // `true` berarti PIN-nya sah tetapi orangnya tidak berwenang.
      known_staff: unauthorizedHolder,
    },
  })

  if (consecutiveFailures >= MAX_EXIT_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_MS
    consecutiveFailures = 0

    await recordPosSecurityEvent({
      eventType: SECURITY_EVENT.KIOSK_EXIT_LOCKED_OUT,
      severity: 'CRITICAL',
      details: { lockout_ms: LOCKOUT_MS, threshold: MAX_EXIT_ATTEMPTS },
    })

    return { ok: false, reason: 'locked-out', retryAfterMs: LOCKOUT_MS }
  }

  return {
    ok: false,
    reason: unauthorizedHolder ? 'not-authorized' : 'bad-pin',
    attemptsLeft,
  }
}

/**
 * Apakah PIN cocok dengan staff yang TIDAK berizin keluar Kiosk?
 *
 * Dipakai hanya untuk memperkaya `details` peristiwa keamanan. Hasilnya tidak
 * pernah mengubah pesan yang dilihat pemakai — lihat catatan pemanggilnya.
 */
async function matchesUnauthorizedStaff(
  pin: string,
  all: LocalStaff[],
  authorized: LocalStaff[],
): Promise<boolean> {
  const authorizedIds = new Set(authorized.map((s) => s.id))
  let found = false
  for (const staff of all) {
    if (authorizedIds.has(staff.id)) continue
    if (await verifyPin(pin, staff.pin_hash)) found = true
  }
  return found
}

/** Pesan yang dilihat pemakai. Sengaja SAMA untuk kedua jenis kegagalan. */
export function exitVerdictMessage(verdict: Exclude<ExitVerdict, { ok: true }>): string {
  if (verdict.reason === 'locked-out') {
    return `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(verdict.retryAfterMs / 1000)} detik.`
  }
  // "PIN salah" dan "tidak berwenang" dijawab identik: membedakannya memberi
  // tahu penebak bahwa PIN-nya benar dan ia hanya perlu mencari orang lain.
  return `PIN tidak berwenang membuka mode Kiosk. Sisa percobaan: ${verdict.attemptsLeft}.`
}
